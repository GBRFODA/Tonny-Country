const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/db');
const axios = require('axios');

// Função auxiliar para editar via Axios (garante zero embeds)
async function patchMessageV2(channelId, messageId, body) {
    return axios.patch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
        body,
        {
            headers: {
                Authorization: `Bot ${process.env.TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );
}

// Para editar a resposta inicial da interação (Webhook)
async function patchWebhookMessage(applicationId, token, body) {
    return axios.patch(
        `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`,
        body,
        {
            headers: { 'Content-Type': 'application/json' }
        }
    );
}

module.exports = {
    async execute(interaction) {
        
        // --- 1. PASSO 1: SELECIONAR MUNDO (BOTÕES) ---
        if (interaction.isButton() && interaction.customId === 'acao_btn_criar') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('acao_sel_primario').setLabel('Mundo Primário').setStyle(ButtonStyle.Primary).setEmoji('🌍'),
                new ButtonBuilder().setCustomId('acao_sel_secundario').setLabel('Mundo Secundário').setStyle(ButtonStyle.Secondary).setEmoji('🌎')
            );

            return await interaction.reply({
                content: '📍 **Onde será realizada essa ação?**\nSelecione o mundo abaixo:',
                components: [row],
                ephemeral: true
            });
        }

        // --- 2. PASSO 2: ABRIR MODAL (COM O MUNDO NO ID) ---
        if (interaction.isButton() && (interaction.customId === 'acao_sel_primario' || interaction.customId === 'acao_sel_secundario')) {
            const mundo = interaction.customId === 'acao_sel_primario' ? 'Primário' : 'Secundário';
            
            // Passamos o mundo escolhido no ID do modal para recuperar depois
            const modal = new ModalBuilder().setCustomId(`acao_modal_submit_${mundo}`).setTitle(`Nova Ação: ${mundo}`);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_nome').setLabel("Nome da Ação").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_vagas').setLabel("Quantidade de Vagas").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_horario').setLabel("Horário").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 20:30").setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        // --- 3. PROCESSAR CRIAÇÃO (MODAL SUBMIT) ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('acao_modal_submit_')) {
            // Recupera o mundo do ID
            const mundo = interaction.customId.split('_')[3];
            
            const nome = interaction.fields.getTextInputValue('in_nome');
            const vagas = parseInt(interaction.fields.getTextInputValue('in_vagas'));
            const horario = interaction.fields.getTextInputValue('in_horario');

            const card = {
                type: 17, accent_color: 0xF1C40F,
                components: [
                    { type: 10, content: `# 🚨 AÇÃO AGENDADA: ${nome.toUpperCase()}` },
                    // ADICIONADO: Campo Mundo
                    { type: 10, content: `🌍 **Mundo:** \`${mundo}\`\n⏰ **Horário:** \`${horario}\`\n👥 **Vagas:** \`0 / ${vagas}\`\n\n**Participantes:**\n*Ninguém ainda.*` },
                    { 
                        type: 1, 
                        components: [
                            { type: 2, style: 3, label: 'Participar', custom_id: `acao_join_X`, emoji: { name: '✅' } },
                            { type: 2, style: 2, label: 'Sair', custom_id: `acao_leave_X` },
                            { type: 2, style: 4, label: 'Encerrar', custom_id: `acao_delete_X`, emoji: { name: '✖️' } }
                        ] 
                    }
                ]
            };

            // Responde ao usuário que criou (Ephemeral)
            await interaction.deferReply({ ephemeral: true });
            
            // Envia a mensagem PÚBLICA no canal (pois a interação original era efêmera)
            // Usamos channel.send padrão do djs aqui pela simplicidade de criar nova msg
            const msgPublica = await interaction.channel.send({
                components: [
                    // Converter estrutura raw para djs components se necessário, ou passar raw se a lib suportar.
                    // Discord.js v14 suporta passar JSON raw em components? As vezes dá erro.
                    // Vamos garantir enviando como payload limpo ou convertendo.
                    // Para segurança, vamos usar o axios postMessageV2 similar ao index.js se tivermos acesso, 
                    // mas como estamos no 'execute' da interaction, temos 'interaction.channel'.
                    // Vamos tentar enviar direto. Se der erro de estrutura, o axios é mais garantido para payloads V2 (containers).
                ]
            });
            
            // Como containers (type 17) são experimentais/específicos, vamos usar axios para garantir
            const response = await axios.post(
                `https://discord.com/api/v10/channels/${interaction.channelId}/messages`,
                { components: [card], flags: (1 << 15) }, // Flags para container
                { headers: { Authorization: `Bot ${process.env.TOKEN}`, 'Content-Type': 'application/json' } }
            );

            const msgId = response.data.id;

            // Salva no banco COM O MUNDO
            const result = db.criarAcao(interaction.user.id, nome, vagas, horario, msgId, interaction.channel.id, mundo);
            const id = result.lastInsertRowid;
            
            // Atualiza IDs dos botões na mensagem pública
            card.components[2].components.forEach(c => c.custom_id = c.custom_id.replace('X', id));
            
            await patchMessageV2(interaction.channelId, msgId, {
                components: [card],
                flags: (1 << 15)
            });

            // Confirmação para o admin
            await interaction.editReply({ content: `✅ Ação criada com sucesso no **Mundo ${mundo}**!` });

            const ping = await interaction.channel.send('@everyone');
            setTimeout(() => ping.delete().catch(() => {}), 2000);
        }

        // --- PARTICIPAR / SAIR ---
        if (interaction.isButton() && (interaction.customId.startsWith('acao_join_') || interaction.customId.startsWith('acao_leave_'))) {
            const [,, id] = interaction.customId.split('_');
            const acao = db.buscarAcao(id);
            if (!acao) return interaction.reply({ content: '❌ Ação não encontrada no banco (pode ter sido deletada).', ephemeral: true });

            let participantes = JSON.parse(acao.participantes);
            if (interaction.customId.includes('join')) {
                if (participantes.includes(interaction.user.id)) return interaction.reply({ content: 'Já estás na lista!', ephemeral: true });
                if (participantes.length >= acao.vagas) return interaction.reply({ content: 'Lotado!', ephemeral: true });
                participantes.push(interaction.user.id);
            } else {
                participantes = participantes.filter(p => p !== interaction.user.id);
            }

            db.atualizarParticipantes(id, participantes);
            const lista = participantes.length > 0 ? participantes.map(p => `> <@${p}>`).join('\n') : '*Ninguém ainda.*';
            
            const novoCard = {
                type: 17, accent_color: 0xF1C40F,
                components: [
                    { type: 10, content: `# 🚨 AÇÃO AGENDADA: ${acao.nome.toUpperCase()}` },
                    // Mantém o mundo ao atualizar
                    { type: 10, content: `🌍 **Mundo:** \`${acao.mundo || 'Não inf.'}\`\n⏰ **Horário:** \`${acao.horario}\`\n👥 **Vagas:** \`${participantes.length} / ${acao.vagas}\`\n\n**Participantes:**\n${lista}` },
                    {
                        type: 1,
                        components: [
                            { type: 2, style: 3, label: 'Participar', custom_id: `acao_join_${id}`, emoji: { name: '✅' } },
                            { type: 2, style: 2, label: 'Sair', custom_id: `acao_leave_${id}` },
                            { type: 2, style: 4, label: 'Encerrar', custom_id: `acao_delete_${id}`, emoji: { name: '✖️' } }
                        ]
                    }
                ]
            };

            await interaction.deferUpdate();
            await patchMessageV2(interaction.channelId, interaction.message.id, {
                components: [novoCard],
                flags: (1 << 15)
            });
        }

        // --- VITÓRIA / DERROTA ---
        if (interaction.isButton() && (interaction.customId.startsWith('acao_win_') || interaction.customId.startsWith('acao_loss_'))) {
            const [,, id] = interaction.customId.split('_');
            const acao = db.buscarAcao(id);
            if (!acao || acao.finalizada) return interaction.reply({ content: 'Ação já finalizada ou deletada.', ephemeral: true });

            const tipo = interaction.customId.includes('win') ? 'vitoria' : 'derrota';
            JSON.parse(acao.participantes).forEach(p => db.adicionarResultado(p, tipo));
            db.finalizarAcaoDb(id);

            const finalCard = {
                type: 17, accent_color: tipo === 'vitoria' ? 0x2ECC71 : 0xE74C3C,
                components: [
                    { type: 10, content: `# 🏁 AÇÃO FINALIZADA: ${acao.nome.toUpperCase()}` },
                    { type: 10, content: `🌍 **Mundo:** ${acao.mundo || 'Não inf.'}\nResultado: **${tipo.toUpperCase()}**\nEstatísticas atualizadas.` },
                    { type: 1, components: [{ type: 2, style: 2, label: 'Registrar Kills', custom_id: `acao_killbtn_${id}`, emoji: { name: '🎯' } }] }
                ]
            };
            
            await interaction.deferUpdate();
            await patchMessageV2(interaction.channelId, interaction.message.id, {
                components: [finalCard],
                flags: (1 << 15)
            });
        }

        // --- REGISTRAR KILLS ---
        if (interaction.isButton() && interaction.customId.startsWith('acao_killbtn_')) {
            const [,, id] = interaction.customId.split('_');
            const modal = new ModalBuilder().setCustomId(`acao_killmodal_${id}`).setTitle('Kills na Ação');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_kills').setLabel("Quantidade de Kills").setStyle(TextInputStyle.Short).setRequired(true)));
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('acao_killmodal_')) {
            const kills = parseInt(interaction.fields.getTextInputValue('in_kills'));
            if (isNaN(kills)) return interaction.reply({ content: 'Número inválido.', ephemeral: true });
            db.adicionarKills(interaction.user.id, kills);
            await interaction.reply({ content: `✅ Registaste **${kills}** kills!`, ephemeral: true });
        }

        // --- DELETAR ---
        if (interaction.isButton() && interaction.customId.startsWith('acao_delete_')) {
            const [,, id] = interaction.customId.split('_');
            db.deletarAcao(id);
            
            await interaction.deferUpdate();
            await patchMessageV2(interaction.channelId, interaction.message.id, {
                components: [{ type: 17, accent_color: 0x2B2D31, components: [{ type: 10, content: `✅ Ação removida.` }] }],
                flags: (1 << 15)
            });
        }
    }
};
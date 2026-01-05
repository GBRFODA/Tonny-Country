const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log('✅ Sistema de Ausências iniciado.');

        // ====================================================
        // 1. TIMER: VERIFICAÇÃO DE VENCIMENTO (A cada 1 hora)
        // ====================================================
        setInterval(async () => {
            const ausencias = db.listarAusenciasVencidas(); // Pega todas as 'aprovado'
            const canalAdminId = db.getConfig('channel_ausencia_admin');
            const canalAdmin = canalAdminId ? client.channels.cache.get(canalAdminId) : null;

            const hoje = new Date();
            hoje.setHours(0,0,0,0); // Zera hora para comparar apenas data

            for (const aus of ausencias) {
                // Converte string "DD/MM/AAAA" para Date
                const partes = aus.dataVolta.split('/');
                const dataVolta = new Date(partes[2], partes[1] - 1, partes[0]);
                dataVolta.setHours(0,0,0,0);

                // Se hoje >= data da volta
                if (hoje >= dataVolta) {
                    // Atualiza status para 'aguardando_retorno' para evitar spam de notificações
                    db.atualizarAusencia(aus.id, 'aguardando_retorno');

                    // 1. Avisa Liderança (Canal Admin)
                    if (canalAdmin) {
                        const embedLider = new EmbedBuilder()
                            .setTitle('⏰ Ausência Finalizada')
                            .setColor('Yellow')
                            .setDescription(`O prazo de ausência de <@${aus.discordId}> acabou hoje (${aus.dataVolta}).\n\nEu enviei uma DM perguntando se ele retornou.`)
                            .setTimestamp();
                        canalAdmin.send({ embeds: [embedLider] });
                    }

                    // 2. Manda DM para o usuário perguntando se voltou
                    try {
                        const user = await client.users.fetch(aus.discordId);
                        if (user) {
                            const embedDm = new EmbedBuilder()
                                .setTitle('✈️ Sua Ausência Acabou')
                                .setDescription(`Olá! Consta no nosso sistema que sua ausência terminaria hoje (**${aus.dataVolta}**).\n\nVocê já retornou às atividades?`)
                                .setColor('Blue');

                            const rowDm = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId(`aus_voltei_${aus.id}`).setLabel('Sim, já voltei!').setStyle(ButtonStyle.Success).setEmoji('✅'),
                                new ButtonBuilder().setCustomId(`aus_nao_${aus.id}`).setLabel('Preciso de mais tempo').setStyle(ButtonStyle.Secondary).setEmoji('⏳')
                            );

                            await user.send({ embeds: [embedDm], components: [rowDm] });
                        }
                    } catch (e) {
                        console.log(`[Ausência] Não consegui enviar DM para ${aus.discordId} (DM fechada?).`);
                    }
                }
            }
        }, 60 * 60 * 1000); // Roda a cada 1 hora

        // ====================================================
        // 2. LISTENER DE INTERAÇÕES (Botões e Modals)
        // ====================================================
        client.on(Events.InteractionCreate, async (interaction) => {
            
            // --- A. CLICOU EM SOLICITAR NO CANAL ---
            if (interaction.isButton() && interaction.customId === 'btn_solicitar_ausencia') {
                const ativa = db.buscarAusenciaAtiva(interaction.user.id);
                if (ativa) {
                    return interaction.reply({ content: `❌ Você já tem uma solicitação pendente ou uma ausência ativa até ${ativa.dataVolta}.`, ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId('modal_ausencia_submit')
                    .setTitle('Solicitação de Ausência');

                const dataInput = new TextInputBuilder()
                    .setCustomId('in_aus_data')
                    .setLabel("Data de Retorno (DD/MM/AAAA)")
                    .setPlaceholder("Ex: 25/12/2025")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(10)
                    .setMaxLength(10)
                    .setRequired(true);

                const motivoInput = new TextInputBuilder()
                    .setCustomId('in_aus_motivo')
                    .setLabel("Motivo da Ausência")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(dataInput), new ActionRowBuilder().addComponents(motivoInput));
                await interaction.showModal(modal);
            }

            // --- B. ENVIOU O FORMULÁRIO (MODAL) ---
            if (interaction.isModalSubmit() && interaction.customId === 'modal_ausencia_submit') {
                const dataVolta = interaction.fields.getTextInputValue('in_aus_data');
                const motivo = interaction.fields.getTextInputValue('in_aus_motivo');

                // Validação simples de data regex (DD/MM/AAAA)
                if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataVolta)) {
                    return interaction.reply({ content: '❌ Formato de data inválido. Use DD/MM/AAAA (Ex: 20/12/2025).', ephemeral: true });
                }

                // Busca dados do usuário (Nome RP para facilitar identificação)
                const userDb = db.buscarUsuario(interaction.user.id);
                const nomeRp = userDb ? `${userDb.nomeRp} | ${userDb.passaporte}` : interaction.user.username;

                // Salva no banco como 'pendente'
                const res = db.criarAusencia(interaction.user.id, nomeRp, dataVolta, motivo);
                const ausenciaId = res.lastInsertRowid;

                // Envia para o canal de aprovação
                const canalAdminId = db.getConfig('channel_ausencia_admin');
                if (!canalAdminId) {
                    return interaction.reply({ content: '✅ Solicitação salva, mas o **Canal de Aprovação** não foi configurado no `/config`. Avise um líder.', ephemeral: true });
                }

                const canalAdmin = interaction.guild.channels.cache.get(canalAdminId);
                if (canalAdmin) {
                    const embedAdmin = new EmbedBuilder()
                        .setTitle('✈️ Nova Solicitação de Ausência')
                        .setColor('Blue')
                        .addFields(
                            { name: '👤 Usuário', value: `<@${interaction.user.id}>\n${nomeRp}`, inline: true },
                            { name: '📅 Retorno', value: dataVolta, inline: true },
                            { name: '📝 Motivo', value: motivo }
                        )
                        .setFooter({ text: `ID: ${ausenciaId}` })
                        .setTimestamp();

                    const rowAdmin = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`aus_apr_${ausenciaId}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`aus_rep_${ausenciaId}`).setLabel('Reprovar').setStyle(ButtonStyle.Danger)
                    );

                    await canalAdmin.send({ embeds: [embedAdmin], components: [rowAdmin] });
                    await interaction.reply({ content: '✅ Solicitação enviada para análise da liderança. Fique atento à sua DM.', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Erro: Canal de aprovação configurado não foi encontrado no servidor.', ephemeral: true });
                }
            }

            // --- C. LIDERANÇA: APROVAÇÃO / REPROVAÇÃO ---
            if (interaction.isButton() && (interaction.customId.startsWith('aus_apr_') || interaction.customId.startsWith('aus_rep_'))) {
                const id = interaction.customId.split('_')[2];
                const ausencia = db.buscarAusenciaPorId(id);

                if (!ausencia) return interaction.reply({ content: '❌ Ausência não encontrada no banco de dados.', ephemeral: true });
                if (ausencia.status !== 'pendente') return interaction.reply({ content: '❌ Esta solicitação já foi processada anteriormente.', ephemeral: true });

                const isAprovar = interaction.customId.startsWith('aus_apr_');
                const novoStatus = isAprovar ? 'aprovado' : 'reprovado';
                const cor = isAprovar ? 'Green' : 'Red';
                const titulo = isAprovar ? '✅ Ausência Aprovada' : '❌ Ausência Reprovada';

                // Atualiza Banco
                db.atualizarAusencia(id, novoStatus);

                // Atualiza Embed do Admin (Remove botões e muda cor)
                const embedOriginal = EmbedBuilder.from(interaction.message.embeds[0]);
                embedOriginal.setTitle(titulo).setColor(cor).addFields({ name: 'Processado por', value: `<@${interaction.user.id}>` });
                await interaction.update({ embeds: [embedOriginal], components: [] });

                // Avisa o Usuário na DM
                try {
                    const user = await client.users.fetch(ausencia.discordId);
                    await user.send({ 
                        content: isAprovar 
                            ? `✅ **Sua ausência foi aprovada!**\nData de volta prevista: **${ausencia.dataVolta}**. Bom descanso!` 
                            : `❌ **Sua ausência foi reprovada.**\nProcure a liderança para mais detalhes.` 
                    });
                } catch(e) {
                    interaction.followUp({ content: `⚠️ Ação registrada, mas não consegui enviar DM para o usuário (DM fechada).`, ephemeral: true });
                }
            }

            // --- D. USUÁRIO (DM): RESPOSTA DE RETORNO ---
            if (interaction.isButton() && (interaction.customId.startsWith('aus_voltei_') || interaction.customId.startsWith('aus_nao_'))) {
                const id = interaction.customId.split('_')[2];
                const ausencia = db.buscarAusenciaPorId(id);

                if (!ausencia) return interaction.reply({ content: 'Registro de ausência não encontrado.', ephemeral: true });

                // CASO 1: VOLTEI
                if (interaction.customId.startsWith('aus_voltei_')) {
                    db.atualizarAusencia(id, 'finalizado');
                    await interaction.update({ content: '✅ Bem-vindo de volta! A liderança e o servidor foram avisados do seu retorno.', components: [] });

                    // Avisa no Chat de Avisos Gerais (channel_warning)
                    const canalAvisosId = db.getConfig('channel_warning');
                    if (canalAvisosId) {
                        const canalAvisos = client.channels.cache.get(canalAvisosId);
                        if (canalAvisos) {
                            const embedAviso = new EmbedBuilder()
                                .setTitle('✈️ Retorno de Ausência')
                                .setColor('Green')
                                .setDescription(`O membro <@${ausencia.discordId}> retornou de sua ausência hoje. Bem-vindo de volta!`)
                                .setTimestamp();
                            canalAvisos.send({ embeds: [embedAviso] });
                        }
                    }
                } 
                // CASO 2: PRECISO DE MAIS TEMPO
                else {
                    await interaction.update({ content: '⏳ Entendido. Por favor, abra um ticket ou fale com a liderança para renegociar sua data.', components: [] });
                    
                    // Avisa Liderança no canal de admin de ausência
                    const canalAdminId = db.getConfig('channel_ausencia_admin');
                    if (canalAdminId) {
                        const canalAdmin = client.channels.cache.get(canalAdminId);
                        if(canalAdmin) {
                            canalAdmin.send(`⚠️ **Atenção:** <@${ausencia.discordId}> informou via DM que **precisa de mais tempo** e não voltou na data prevista (${ausencia.dataVolta}). Entrem em contato.`);
                        }
                    }
                }
            }
        });
    }
};
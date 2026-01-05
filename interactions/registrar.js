const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/db');
// Não precisamos mais do config.json para o cargo!

module.exports = {
    async execute(interaction) {
        
        // 1. CLIQUE INICIAL (Botão "Registrar" do Painel Fixo)
        if (interaction.isButton() && interaction.customId === 'reg_btn_iniciar') {
            const modal = new ModalBuilder().setCustomId('reg_modal_submit').setTitle('Registro');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_nome').setLabel("Nome RP").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_id').setLabel("Passaporte").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_indicado').setLabel("Indicado por").setStyle(TextInputStyle.Short).setRequired(false))
            );
            await interaction.showModal(modal);
        }

        // 2. ENVIAR FORMULÁRIO (Busca o canal do DB e manda o container V2)
        if (interaction.isModalSubmit() && interaction.customId === 'reg_modal_submit') {
            const nome = interaction.fields.getTextInputValue('input_nome');
            const idGame = interaction.fields.getTextInputValue('input_id');
            const indicado = interaction.fields.getTextInputValue('input_indicado') || "Ninguém";

            db.salvarUsuario({ discordId: interaction.user.id, nomeRp: nome, passaporte: idGame, indicado: indicado, status: 'pendente' });

            const channelId = db.getConfig('channel_aprovacao');
            const channel = channelId ? interaction.guild.channels.cache.get(channelId) : null;

            if (channel) {
                const containerAdm = {
                    type: 17, accent_color: 0xFFFF00,
                    components: [
                        { type: 10, content: `### 🔔 Nova Solicitação` },
                        { 
                            type: 9, 
                            components: [{ type: 10, content: `**User:** ${interaction.user}\n**ID:** \`${idGame}\`\n**Nome:** ${nome}` }], 
                            accessory: { type: 11, media: { url: interaction.user.displayAvatarURL({extension:'png'}) } } 
                        },
                        { type: 1, components: [
                            new ButtonBuilder().setCustomId(`reg_aprovar_${interaction.user.id}`).setLabel('Aprovar').setStyle(ButtonStyle.Success).toJSON(),
                            new ButtonBuilder().setCustomId(`reg_negar_${interaction.user.id}`).setLabel('Negar').setStyle(ButtonStyle.Danger).toJSON()
                        ]}
                    ]
                };
                await channel.send({ components: [containerAdm], flags: (1<<15) });
                await interaction.reply({ content: 'Seus dados foram enviados para a staff!', flags: 64 });
            } else {
                await interaction.reply({ content: '❌ Erro: Canal de aprovação não configurado.', flags: 64 });
            }
        }

        // 3. APROVAR / NEGAR (Lógica V2)
        if (interaction.isButton() && (interaction.customId.startsWith('reg_aprovar_') || interaction.customId.startsWith('reg_negar_'))) {
            const [,, userId] = interaction.customId.split('_');
            const isAprovar = interaction.customId.includes('aprovar');

            if (isAprovar) {
                const dados = db.buscarUsuario(userId);
                if (dados) {
                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        // Pega o cargo do DB
                        const roleId = db.getConfig('role_aprovacao');
                        
                        // Muda o Nick
                        await member.setNickname(`${dados.nomeRp} | ${dados.passaporte}`).catch(() => console.log('Sem permissão para nick'));
                        
                        // Dá o Cargo
                        if (roleId) {
                            await member.roles.add(roleId).catch(() => console.log('Sem permissão para cargo ou cargo inválido'));
                        } else {
                            console.log('Cargo de aprovação não configurado no /config');
                        }
                        
                        dados.status = 'aprovado';
                        db.salvarUsuario(dados);
                        
                        // Atualiza o painel da staff (V2)
                        await interaction.update({ components: [{type:17, accent_color:0x00FF00, components:[{type:10, content:`✅ Aprovado: <@${userId}>`}]}], flags:(1<<15) });

                        // Mensagem Customizada no PV
                        const msgCustom = db.getConfig('msg_aprovacao_pv') || "Parabéns! Seu registro foi aprovado e você já pode entrar na cidade.";
                        await member.send(msgCustom).catch(() => {});

                    } else {
                        await interaction.reply({ content: 'Usuário não está no servidor.', flags: 64 });
                    }
                }
            } else {
                // Negado (V2)
                await interaction.update({ components: [{type:17, accent_color:0xFF0000, components:[{type:10, content:`❌ Negado.`}]}], flags:(1<<15) });
            }
        }
    }
};
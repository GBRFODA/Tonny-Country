const { PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    async execute(interaction) {

        // ====================================================
        // 1. ABRIR SALA DE FARM
        // ====================================================
        if (interaction.isButton() && interaction.customId === 'farm_btn_open') {
            const guild = interaction.guild;
            const user = interaction.user;

            // Verificação de sala existente
            const salaAtiva = db.buscarSalaFarmPorUsuario(user.id);
            if (salaAtiva) {
                const canalExiste = guild.channels.cache.get(salaAtiva.channelId);
                
                if (canalExiste) {
                    return interaction.reply({ 
                        content: `❌ **Você já possui uma sala de farm aberta:** <#${salaAtiva.channelId}>\nFeche a anterior antes de abrir uma nova.`, 
                        flags: 64 
                    });
                } else {
                    return interaction.reply({ 
                        content: `⚠️ **Erro de Sincronia:** Use o comando \`/resetarfarm\` para corrigir seu status.`, 
                        flags: 64 
                    });
                }
            }
            
            // Configurações e Múltiplas Metas
            const approverRoleId = db.getConfig('farm_role_approver');
            const metaPeriod = db.getConfig('farm_meta_period') || "Não definido";
            const metasCadastradas = db.listarMetasFarm(); // Busca todas as metas da nova tabela

            const permissionOverwrites = [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ];

            if (approverRoleId) {
                const roleExiste = guild.roles.cache.get(approverRoleId);
                if (roleExiste) {
                    permissionOverwrites.push({ id: approverRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
                }
            }

            try {
                const channel = await guild.channels.create({
                    name: `farm-${user.username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`, 
                    type: ChannelType.GuildText,
                    parent: interaction.channel.parentId, 
                    permissionOverwrites: permissionOverwrites
                });

                // Registra a sala no banco
                db.registrarSalaFarm(channel.id, user.id, metaPeriod, "", "", "");

                // Formata a lista de metas para exibição
                let textoMetas = metasCadastradas.length > 0 
                    ? metasCadastradas.map(m => `> • **${m.metaQty}x ${m.metaType}** (${m.metaDesc})`).join('\n')
                    : "*Nenhuma meta definida no momento.*";

                const welcomeContainer = {
                    type: 17, accent_color: 0x00FF00,
                    components: [
                        { type: 10, content: `# 👋 Bem-vindo ao Farm\nOlá ${user}, este é seu chat de metas para o período: **${metaPeriod}**.` },
                        { type: 14 },
                        { type: 10, content: `### 🎯 Objetivos Atuais:\n${textoMetas}` },
                        { type: 14 },
                        { type: 1, components: [
                            { type: 2, style: 4, label: 'Fechar Sala', custom_id: 'farm_btn_close', emoji: {name:'🔒'} },
                            { type: 2, style: 2, label: 'Ver Metas', custom_id: 'farm_btn_info', emoji: {name:'📋'} }
                        ]}
                    ]
                };

                await channel.send({ components: [welcomeContainer], flags: (1 << 15) });
                await interaction.reply({ content: `✅ Sala criada com sucesso: ${channel}`, flags: 64 });

            } catch (err) {
                console.error('ERRO AO CRIAR SALA DE FARM:', err);
                await interaction.reply({ content: 'Erro ao criar sala. Verifique as permissões do bot.', flags: 64 });
            }
        }

        // ====================================================
        // 2. VER INFORMAÇÕES (LISTAR MÚLTIPLAS METAS)
        // ====================================================
        if (interaction.isButton() && interaction.customId === 'farm_btn_info') {
            const dadosSala = db.buscarSalaFarm(interaction.channelId);
            const metas = db.listarMetasFarm(); // Busca lista atualizada

            if (!dadosSala) return interaction.reply({ content: '❌ Dados da sala não encontrados.', flags: 64 });

            let listaMetas = metas.length > 0 
                ? metas.map(m => `**${m.metaQty}x ${m.metaType}**\n└ *${m.metaDesc}*`).join('\n\n')
                : "Nenhuma meta cadastrada.";

            const infoContainer = {
                type: 17, accent_color: 0x5865F2,
                components: [
                    { type: 10, content: `### 📋 Objetivos do Ciclo (${dadosSala.metaPeriod})` },
                    { type: 14 },
                    { type: 10, content: listaMetas }
                ]
            };
            await interaction.reply({ components: [infoContainer], flags: (1<<15) | 64 });
        }

        // ====================================================
        // 3. FECHAR SALA
        // ====================================================
        if (interaction.isButton() && interaction.customId === 'farm_btn_close') {
            await interaction.reply({ content: '🔒 Fechando sala em 5 segundos...', flags: 64 });
            db.fecharSalaFarm(interaction.channelId);
            setTimeout(() => { interaction.channel.delete().catch(() => {}); }, 5000);
        }
    }
};
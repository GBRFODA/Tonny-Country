const { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    async execute(interaction) {

        // ====================================================
        // 1. ABRIR SALA DE FARM
        // ====================================================
        // Aceita 'farm_btn_open' (novo) e 'farm_iniciar' (antigo) para manter compatibilidade com botões já enviados
        if (interaction.isButton() && (interaction.customId === 'farm_btn_open' || interaction.customId === 'farm_iniciar')) {
            const guild = interaction.guild;
            const user = interaction.user;

            // 1.1 Verificar se o usuário já possui uma sala registrada no banco
            const salaAtiva = db.buscarSalaFarmPorUsuario(user.id);
            
            if (salaAtiva) {
                // Se a sala existe no banco, verificamos se o canal ainda existe no Discord
                const canalExiste = guild.channels.cache.get(salaAtiva.channelId);
                
                if (canalExiste) {
                    return interaction.reply({ 
                        content: `❌ **Você já possui uma sala de farm aberta:** <#${salaAtiva.channelId}>\nFinalize a anterior antes de abrir uma nova.`, 
                        ephemeral: true 
                    });
                } else {
                    // Se o canal foi deletado manualmente mas consta no banco, limpamos o registro
                    db.limparFarmUsuario(user.id);
                }
            }

            // 1.2 Configurações de Permissão
            const approverRole = db.getConfig('role_farm_approver');
            
            // Permissões Base:
            // - @everyone: Não vê nada
            // - Usuário (Dono): Vê, Envia Mensagens, Anexa Arquivos (Prints), Lê Histórico. NÃO pode gerenciar canais.
            const permissionOverwrites = [
                { 
                    id: guild.id, 
                    deny: [PermissionFlagsBits.ViewChannel] 
                },
                { 
                    id: user.id, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory], 
                    deny: [PermissionFlagsBits.ManageChannels] 
                }
            ];

            // Permissão Extra: Se houver cargo de gerente configurado, ele pode ver e moderar
            if (approverRole) {
                permissionOverwrites.push({ 
                    id: approverRole, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels] 
                });
            }

            try {
                // 1.3 Criar o Canal
                const channel = await guild.channels.create({
                    name: `farm-${user.username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`, // Limpa caracteres especiais do nome
                    type: ChannelType.GuildText,
                    parent: interaction.channel.parentId, // Cria na mesma categoria do painel
                    permissionOverwrites: permissionOverwrites
                });

                // 1.4 Registrar no Banco de Dados
                db.registrarSalaFarm(channel.id, user.id);

                // 1.5 Enviar Mensagem de Boas-vindas
                const embed = new EmbedBuilder()
                    .setTitle(`🌾 Sala de Farm: ${user.username}`)
                    .setDescription(`Olá ${user}!\n\n**Como registrar seu farm:**\n1. Envie a **print** (imagem) dos seus itens aqui neste chat.\n2. Aguarde um gerente analisar e aprovar.\n3. Quando aprovado, você receberá o ID do registro.\n\n⚠️ **Atenção:** Apenas gerentes podem fechar esta sala.`)
                    .setColor('Green')
                    .setFooter({ text: 'Sistema de Logs Global • Tonny Country' })
                    .setTimestamp();

                // Botão de Fechar (Apenas Gerentes poderão usar, validado abaixo)
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('farm_btn_close')
                        .setLabel('Fechar Sala (Gerente)')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

                await channel.send({ content: `${user}`, embeds: [embed], components: [row] });
                
                // Feedback para quem clicou no botão
                await interaction.reply({ content: `✅ Sala criada com sucesso: ${channel}`, ephemeral: true });

            } catch (err) {
                console.error('ERRO AO CRIAR SALA DE FARM:', err);
                await interaction.reply({ content: '❌ Erro ao criar sala. Verifique se o bot tem permissão de "Gerenciar Canais" no servidor.', ephemeral: true });
            }
        }

        // ====================================================
        // 2. FECHAR SALA (RESTRICTED TO MANAGERS)
        // ====================================================
        if (interaction.isButton() && interaction.customId === 'farm_btn_close') {
            const approverRole = db.getConfig('role_farm_approver');

            // Verifica se quem clicou tem o cargo de gerente configurado
            if (!approverRole || !interaction.member.roles.cache.has(approverRole)) {
                return interaction.reply({ 
                    content: '⛔ **Acesso Negado:** Apenas a gerência (Cargo Aprovador) pode fechar esta sala.', 
                    ephemeral: true 
                });
            }

            await interaction.reply({ content: '🔒 Fechando sala e limpando registros em 3 segundos...', ephemeral: true });
            
            // Remove do banco de dados para liberar o usuário
            db.fecharSalaFarm(interaction.channelId);
            
            // Deleta o canal após delay
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 3000);
        }

        // ====================================================
        // 3. APROVAR FARM (LÓGICA PRINCIPAL DE LOGS)
        // ====================================================
        // O ID do botão é dinâmico: "farm_approve_ID_DA_MENSAGEM_ORIGINAL"
        // Isso nos permite saber exatamente qual imagem aprovar
        if (interaction.isButton() && interaction.customId.startsWith('farm_approve_')) {
            const targetMsgId = interaction.customId.split('_')[2];
            const approverRole = db.getConfig('role_farm_approver');
            const logChannelId = db.getConfig('channel_logs_farm');

            // 3.1 Verificações de Segurança
            
            // Verifica permissão do usuário
            if (!approverRole || !interaction.member.roles.cache.has(approverRole)) {
                return interaction.reply({ content: '❌ Você não tem permissão para aprovar este farm.', ephemeral: true });
            }
            
            // Verifica se o canal de logs existe na config
            if (!logChannelId) {
                return interaction.reply({ content: '⚠️ **Erro de Configuração:** O Canal de Logs não foi definido no `/config`. Não é possível salvar o farm.', ephemeral: true });
            }

            // DeferReply para dar tempo de processar a imagem
            await interaction.deferReply({ ephemeral: true });

            try {
                // 3.2 Buscar a mensagem original (Print)
                const targetMsg = await interaction.channel.messages.fetch(targetMsgId).catch(() => null);
                
                // Valida se a mensagem ainda existe e tem imagem
                if (!targetMsg || targetMsg.attachments.size === 0) {
                    return interaction.editReply('❌ A mensagem original ou a imagem não foi encontrada (pode ter sido apagada pelo usuário).');
                }

                const attachment = targetMsg.attachments.first();
                const farmer = targetMsg.author;

                // 3.3 Registrar no Banco (Gera o ID Global Sequencial)
                const globalId = db.registrarLogFarm(farmer.id, interaction.user.id, interaction.channelId);

                // 3.4 Enviar para o Canal de Logs (Reenviando o arquivo físico)
                // Isso é crucial: baixamos e reenviamos para que o link nunca expire, mesmo se a sala for deletada
                const logChannel = interaction.guild.channels.cache.get(logChannelId);
                
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle(`📦 Farm Aprovado • Registro #${globalId}`)
                        .setColor('Gold')
                        .addFields(
                            { name: '👤 Farmador', value: `${farmer} \n\`(${farmer.id})\``, inline: true },
                            { name: '🛡️ Aprovado por', value: `${interaction.user} \n\`(${interaction.user.id})\``, inline: true },
                            { name: '🆔 ID Global', value: `\`#${globalId}\``, inline: true },
                            { name: '📅 Data', value: `<t:${Math.floor(Date.now()/1000)}:f>`, inline: false }
                        )
                        .setImage(`attachment://${attachment.name}`) // Referencia o anexo local
                        .setFooter({ text: 'Tonny Country • Sistema de Farm Seguro' })
                        .setTimestamp();

                    await logChannel.send({ 
                        embeds: [logEmbed], 
                        files: [{ attachment: attachment.url, name: attachment.name }] // Re-upload da imagem
                    });
                } else {
                    return interaction.editReply('⚠️ O farm foi registrado no banco, mas o Canal de Logs configurado não foi encontrado no Discord.');
                }

                // 3.5 Limpeza Visual: Apagar a mensagem de "Pedido de Aprovação" do Bot
                // (Para não ficar poluir o chat com botões já clicados)
                await interaction.message.delete().catch(() => {});

                // 3.6 Feedback Final na Sala do Usuário
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('✅ Farm Aprovado e Catalogado')
                    .setDescription(`O registro foi salvo com sucesso no sistema.\n\n🆔 **ID Global:** \`#${globalId}\`\n👮 **Aprovado por:** ${interaction.user}`)
                    .setColor('Green')
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/190/190411.png') // Ícone de Check genérico ou do servidor
                    .setTimestamp();
                
                await interaction.channel.send({ content: `${farmer}`, embeds: [confirmEmbed] });
                
                await interaction.editReply('✅ Farm processado e logado com sucesso.');

            } catch (err) {
                console.error('ERRO AO APROVAR FARM:', err);
                await interaction.editReply('❌ Ocorreu um erro interno ao processar a aprovação. Verifique o console.');
            }
        }
    }
};
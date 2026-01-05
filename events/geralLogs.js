const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const db = require('../utils/db');

// Helper atualizado para aceitar arquivos (imagens)
async function enviarLog(guild, configKey, embed, files = []) {
    const channelId = db.getConfig(configKey);
    // Se não tiver canal configurado, não faz nada
    if (!channelId || channelId === 'Não definido') return;

    const channel = guild.channels.cache.get(channelId);
    if (channel) {
        // Envia com os arquivos anexados (isso faz o "backup" da imagem)
        channel.send({ embeds: [embed], files: files }).catch(err => console.error("Erro ao enviar log:", err));
    }
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log('✅ Módulo de Logs Gerais iniciado e monitorando (com suporte a Imagens).');

        // =====================================================================
        // 1. LOGS DE MENSAGENS (channel_log_messages)
        // =====================================================================
        
        // Mensagem Apagada
        client.on(Events.MessageDelete, async (message) => {
            if (message.author?.bot) return; // Ignora bots
            if (!message.guild) return; // Ignora DM

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Mensagem Apagada')
                .setColor('Red')
                .addFields(
                    { name: 'Autor', value: `<@${message.author?.id || 'Desconhecido'}>`, inline: true },
                    { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'Conteúdo', value: message.content ? message.content.substring(0, 1024) : '*[Apenas Imagem/Arquivo]*' }
                )
                .setTimestamp();
            
            // Lógica para Salvar Imagem/Arquivo
            const files = [];
            if (message.attachments.size > 0) {
                message.attachments.forEach(attachment => {
                    // Adiciona o arquivo para re-upload
                    files.push({ attachment: attachment.url, name: attachment.name });
                });

                // Tenta exibir a primeira imagem diretamente no Embed para ficar bonito
                const firstImage = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
                if (firstImage) {
                    embed.setImage(`attachment://${firstImage.name}`);
                }

                embed.addFields({ name: 'Anexos', value: `${message.attachments.size} arquivo(s) recuperado(s)` });
            }

            enviarLog(message.guild, 'channel_log_messages', embed, files);
        });

        // Mensagem Editada
        client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
            if (newMessage.author?.bot) return;
            if (!newMessage.guild) return;
            // Ignora se o conteúdo for igual (ex: mudança apenas de link/embed)
            if (oldMessage.content === newMessage.content) return; 

            const embed = new EmbedBuilder()
                .setTitle('✏️ Mensagem Editada')
                .setColor('Yellow')
                .addFields(
                    { name: 'Autor', value: `<@${newMessage.author.id}>`, inline: true },
                    { name: 'Canal', value: `<#${newMessage.channel.id}>`, inline: true },
                    { name: 'Antiga', value: oldMessage.content ? oldMessage.content.substring(0, 1024) : '*[Desconhecido]*' },
                    { name: 'Nova', value: newMessage.content ? newMessage.content.substring(0, 1024) : '*[Vazio]*' }
                )
                .setURL(newMessage.url)
                .setTimestamp();

            enviarLog(newMessage.guild, 'channel_log_messages', embed);
        });

        // =====================================================================
        // 2. LOGS DE VOZ (channel_log_voice)
        // =====================================================================
        client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
            const guild = newState.guild;
            const member = newState.member;
            if (!member) return;

            let embed = new EmbedBuilder().setTimestamp();
            let enviou = false;

            // Entrou em Call
            if (!oldState.channelId && newState.channelId) {
                embed.setTitle('🔊 Entrou em Call')
                    .setColor('Green')
                    .setDescription(`<@${member.id}> entrou no canal **${newState.channel.name}**`);
                enviou = true;
            }
            // Saiu de Call
            else if (oldState.channelId && !newState.channelId) {
                embed.setTitle('🔇 Saiu de Call')
                    .setColor('Red')
                    .setDescription(`<@${member.id}> saiu do canal **${oldState.channel.name}**`);
                enviou = true;
            }
            // Mudou de Call
            else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                embed.setTitle('↔️ Mudou de Canal')
                    .setColor('Blue')
                    .setDescription(`<@${member.id}> moveu-se de **${oldState.channel.name}** para **${newState.channel.name}**`);
                enviou = true;
            }
            // Updates no mesmo canal (Stream/Camera)
            else if (oldState.channelId === newState.channelId) {
                // Stream
                if (!oldState.streaming && newState.streaming) {
                    embed.setTitle('📹 Iniciou Transmissão').setColor('Purple').setDescription(`<@${member.id}> começou a transmitir em **${newState.channel.name}**`);
                    enviou = true;
                } else if (oldState.streaming && !newState.streaming) {
                    embed.setTitle('📹 Parou Transmissão').setColor('Grey').setDescription(`<@${member.id}> parou de transmitir em **${newState.channel.name}**`);
                    enviou = true;
                }
                // Camera (Só loga se não foi junto com stream para evitar flood)
                if (!enviou) {
                    if (!oldState.selfVideo && newState.selfVideo) {
                        embed.setTitle('📸 Ligou Câmera').setColor('Purple').setDescription(`<@${member.id}> ligou a câmera em **${newState.channel.name}**`);
                        enviou = true;
                    } else if (oldState.selfVideo && !newState.selfVideo) {
                        embed.setTitle('📸 Desligou Câmera').setColor('Grey').setDescription(`<@${member.id}> desligou a câmera em **${newState.channel.name}**`);
                        enviou = true;
                    }
                }
            }

            if (enviou) {
                enviarLog(guild, 'channel_log_voice', embed);
            }
        });

        // =====================================================================
        // 3. LOGS DE MEMBROS (channel_log_members)
        // =====================================================================
        
        client.on(Events.GuildMemberAdd, async (member) => {
            const embed = new EmbedBuilder()
                .setTitle('📥 Membro Entrou')
                .setColor('Green')
                .setThumbnail(member.user.displayAvatarURL())
                .setDescription(`**${member.user.tag}** entrou no servidor.`)
                .addFields(
                    { name: 'ID', value: member.id, inline: true },
                    { name: 'Conta Criada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setTimestamp();
            enviarLog(member.guild, 'channel_log_members', embed);
        });

        client.on(Events.GuildMemberRemove, async (member) => {
            const embed = new EmbedBuilder()
                .setTitle('📤 Membro Saiu')
                .setColor('Red')
                .setThumbnail(member.user.displayAvatarURL())
                .setDescription(`**${member.user.tag}** saiu do servidor.`)
                .addFields(
                    { name: 'ID', value: member.id, inline: true },
                    { name: 'Cargos', value: member.roles.cache.map(r => r.name).join(', ').substring(0, 1024) || 'Nenhum' }
                )
                .setTimestamp();
            enviarLog(member.guild, 'channel_log_members', embed);
        });

        client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
            // Nickname
            if (oldMember.nickname !== newMember.nickname) {
                const embed = new EmbedBuilder()
                    .setTitle('🏷️ Apelido Alterado')
                    .setColor('Blue')
                    .setDescription(`**${newMember.user.tag}** mudou de apelido.`)
                    .addFields(
                        { name: 'Antes', value: oldMember.nickname || '*Nenhum*', inline: true },
                        { name: 'Depois', value: newMember.nickname || '*Nenhum*', inline: true }
                    )
                    .setTimestamp();
                enviarLog(newMember.guild, 'channel_log_members', embed);
            }
            // Cargos
            const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
            const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

            if (addedRoles.size > 0 || removedRoles.size > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ Cargos Atualizados')
                    .setColor('Blue')
                    .setDescription(`Cargos de <@${newMember.id}> foram alterados.`)
                    .setTimestamp();
                
                if (addedRoles.size > 0) embed.addFields({ name: 'Adicionados', value: addedRoles.map(r => `<@&${r.id}>`).join(', ') });
                if (removedRoles.size > 0) embed.addFields({ name: 'Removidos', value: removedRoles.map(r => `<@&${r.id}>`).join(', ') });

                enviarLog(newMember.guild, 'channel_log_members', embed);
            }
        });

        // =====================================================================
        // 4. LOGS DE MODERAÇÃO & SERVIDOR (channel_log_mod)
        // =====================================================================

        client.on(Events.GuildBanAdd, async (ban) => {
            const embed = new EmbedBuilder().setTitle('🔨 Membro Banido').setColor('DarkRed').setDescription(`**${ban.user.tag}** foi banido.`).setTimestamp();
            enviarLog(ban.guild, 'channel_log_mod', embed);
        });

        client.on(Events.GuildBanRemove, async (ban) => {
            const embed = new EmbedBuilder().setTitle('🔓 Membro Desbanido').setColor('Green').setDescription(`**${ban.user.tag}** foi desbanido.`).setTimestamp();
            enviarLog(ban.guild, 'channel_log_mod', embed);
        });

        client.on(Events.ChannelCreate, async (channel) => {
            if (!channel.guild) return;
            const embed = new EmbedBuilder().setTitle('📺 Canal Criado').setColor('Green').setDescription(`Canal **#${channel.name}** foi criado.`).addFields({ name: 'Tipo', value: `${channel.type}`, inline: true }).setTimestamp();
            enviarLog(channel.guild, 'channel_log_mod', embed);
        });

        client.on(Events.ChannelDelete, async (channel) => {
            if (!channel.guild) return;
            const embed = new EmbedBuilder().setTitle('🗑️ Canal Deletado').setColor('Red').setDescription(`Canal **#${channel.name}** foi deletado.`).setTimestamp();
            enviarLog(channel.guild, 'channel_log_mod', embed);
        });

        client.on(Events.GuildRoleCreate, async (role) => {
            const embed = new EmbedBuilder().setTitle('🛡️ Cargo Criado').setColor('Green').setDescription(`Cargo **${role.name}** criado.`).setTimestamp();
            enviarLog(role.guild, 'channel_log_mod', embed);
        });

        client.on(Events.GuildRoleDelete, async (role) => {
            const embed = new EmbedBuilder().setTitle('🗑️ Cargo Deletado').setColor('Red').setDescription(`Cargo **${role.name}** deletado.`).setTimestamp();
            enviarLog(role.guild, 'channel_log_mod', embed);
        });
    }
};
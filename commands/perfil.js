const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Exibe o seu perfil ou de outro usuário (Stats, Passaporte, etc).')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Usuário para ver o perfil (Opcional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        await interaction.deferReply();

        try {
            const dados = db.buscarUsuario(targetUser.id);

            if (!dados) {
                return interaction.editReply({ content: `❌ **Perfil não encontrado:** O usuário ${targetUser} ainda não se registrou.` });
            }

            const kills = dados.kills || 0;
            const mortes = dados.derrotas || 0;
            const kd = mortes > 0 ? (kills / mortes).toFixed(2) : kills;

            let cargo = "Membro";
            let cor = 0x3db9db;
            if (dados.perm_level === 2) { cargo = "Gerente"; cor = 0x3498DB; }
            if (dados.perm_level >= 3) { cargo = "Administrador"; cor = 0xE74C3C; }

            const embed = new EmbedBuilder()
                .setColor(cor)
                .setTitle(`📂 Perfil de ${dados.nomeRp}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '🆔 Passaporte', value: `\`${dados.passaporte}\``, inline: true },
                    { name: '🛡️ Cargo', value: `\`${cargo}\``, inline: true },
                    { name: '📅 Registrado em', value: `<t:${Math.floor(new Date(dados.dataRegistro).getTime() / 1000)}:d>`, inline: true },
                    { name: '\u200B', value: '\u200B' },
                    { name: '⚔️ Kills', value: `\`${kills}\``, inline: true },
                    { name: '💀 Mortes', value: `\`${mortes}\``, inline: true },
                    { name: '📈 K/D Ratio', value: `\`${kd}\``, inline: true },
                    { name: '\u200B', value: '\u200B' },
                    { name: '🏆 Vitórias em Ação', value: `\`${dados.vitorias || 0}\``, inline: true },
                    { name: '🤝 Indicado por', value: `${dados.indicado !== 'Ninguém' && dados.indicado !== 'undefined' ? `<@${dados.indicado}>` : 'Ninguém'}`, inline: true }
                )
                .setFooter({ text: 'Grind System • Gestão Inteligente', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[CMD PERFIL] Erro:', error);
            interaction.editReply({ content: '❌ Erro ao carregar o perfil.' });
        }
    },
};
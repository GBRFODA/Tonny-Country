const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetarfarm')
        .setDescription('Desbuga um usuário que não consegue abrir sala de farm.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('O usuário para resetar (apenas Admin). Se vazio, reseta você mesmo.')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Pega o usuário alvo
        const targetUser = interaction.options.getUser('usuario');
        
        // Lógica de Permissão:
        // Se escolheu um alvo, precisa ser ADMIN.
        // Se não escolheu alvo (resetar a si mesmo), qualquer um pode (para sair do bug).
        if (targetUser && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Apenas administradores podem resetar outros usuários.', flags: 64 });
        }

        const userToReset = targetUser || interaction.user;

        // Limpa no Banco
        db.limparFarmUsuario(userToReset.id);

        await interaction.reply({ 
            content: `✅ O status de farm do usuário ${userToReset} foi resetado com sucesso!\nAgora ele pode abrir uma nova sala.`, 
            flags: 64 
        });
    }
};
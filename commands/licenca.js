const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('licenca')
        .setDescription('Verifica o status da licença premium deste servidor'),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'Este comando só funciona em servidores.', ephemeral: true });
        }

        try {
            // Busca dados do premium
            const dados = db.getPremiumData(interaction.guild.id);
            const now = Date.now();

            // Verifica se existe e se ainda é válido
            if (!dados || dados.expiresAt < now) {
                return interaction.reply({ 
                    content: '❌ **Este servidor não possui uma licença ativa.**\nPeça a um administrador para usar `/ativar`.',
                    ephemeral: true 
                });
            }

            // Calcula tempo restante em timestamp do Discord
            const timestamp = Math.floor(dados.expiresAt / 1000);

            // Cria uma barra de progresso visual (opcional, apenas estética)
            // Lógica simples: Se falta muito tempo (verde), se falta pouco (vermelho) - Visual no embed
            
            const embed = {
                color: 0x3db9db, // Verde
                title: '💎 Grind System Premium',
                fields: [
                    { name: 'Status', value: '✅ **Ativo**', inline: true },
                    { name: 'Expira em', value: `<t:${timestamp}:f> (<t:${timestamp}:R>)`, inline: false } // Ex: "em 29 dias"
                ],
                footer: { text: `Server ID: ${interaction.guild.id}` }
            };

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'Erro ao verificar licença.', ephemeral: true });
        }
    },
};
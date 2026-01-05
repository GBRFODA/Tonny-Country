const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const db = require('../utils/db');

// URL PÚBLICA DO MANAGER (Configurada para o subdomínio Manager na Discloud)
const MANAGER_API_URL = 'https://managergrind.discloud.app/api';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ativar')
        .setDescription('Ativa uma licença premium no servidor.')
        .addStringOption(option => 
            option.setName('key')
                .setDescription('Chave de licença (KEY-XXXX-XXXX)')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ Apenas o dono do servidor pode ativar licenças.', ephemeral: true });
        }

        const key = interaction.options.getString('key');
        await interaction.deferReply({ ephemeral: true });

        try {
            // Conecta na API integrada ao site do Manager
            const response = await axios.post(`${MANAGER_API_URL}/activate`, {
                key: key,
                guildId: interaction.guild.id,
                clientName: interaction.guild.name,
                ownerId: interaction.user.id
            });

            if (response.data.success) {
                const days = response.data.days;
                const expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);
                
                // Cache local da licença no Client
                db.definirPremium(interaction.guild.id, expiresAt);

                await interaction.editReply({ 
                    content: `✅ **Sucesso!** Licença **${response.data.type.toUpperCase()}** ativada.\n` +
                             `📅 Validade: **${days} dias**\n` +
                             `🎉 Obrigado por usar o Grind System!`
                });
            }

        } catch (error) {
            console.error('[CMD ATIVAR] Erro:', error.response?.data || error.message);
            
            // Tratamento amigável de erro de conexão
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.response?.status === 404 || error.response?.status === 502) {
                return interaction.editReply('❌ **Erro de Conexão:** O servidor de licenças está offline ou reiniciando. Tente novamente em 2 minutos.');
            }

            const msgErro = error.response?.data?.error || 'Erro desconhecido ao validar chave.';
            await interaction.editReply(`❌ **Erro:** ${msgErro}`);
        }
    },
};
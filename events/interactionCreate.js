const { Events } = require('discord.js');
const db = require('../utils/db');
const axios = require('axios');

// URL DA API (Certifique-se que o Manager está rodando na Discloud)
const MANAGER_API_URL = 'https://managergrind.discloud.app/api';

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // ====================================================
            // 🛡️ VERIFICAÇÃO DE PREMIUM (EM TEMPO REAL)
            // ====================================================
            if (interaction.guild) {
                // O comando '/ativar' é a única exceção (para permitir colocar uma key nova)
                if (interaction.commandName !== 'ativar') {
                    
                    let isPremium = false;

                    try {
                        // 1. Pergunta ao Manager AGORA se a licença tá valendo
                        // Timeout curto (2s) para não deixar o bot lento
                        const response = await axios.get(`${MANAGER_API_URL}/check/${interaction.guild.id}`, { timeout: 2000 });
                        
                        if (response.data.active === false) {
                            // 🚨 REVOGADO! O Manager disse que não vale mais.
                            // Apaga do banco local imediatamente.
                            console.log(`[BLOQUEIO] Licença revogada detectada em ${interaction.guild.name}. Bloqueando...`);
                            db.definirPremium(interaction.guild.id, 0);
                            isPremium = false;
                        } else {
                            // ✅ Tudo certo. Se tiver data nova, atualiza o cache.
                            if (response.data.expiresAt) {
                                db.definirPremium(interaction.guild.id, response.data.expiresAt);
                            }
                            isPremium = true;
                        }

                    } catch (apiError) {
                        // ⚠️ Se a Discloud/API estiver offline, usa o banco local como fallback
                        // Isso impede que o bot pare de funcionar se a net oscilar
                        isPremium = db.checkPremium(interaction.guild.id);
                    }

                    // Se no final não tiver licença válida, BLOQUEIA.
                    if (!isPremium) {
                        const embedBloqueio = {
                            color: 0xFF0000,
                            title: '🚫 ACESSO SUSPENSO',
                            description: `A licença deste servidor foi **revogada** ou **expirou**.\n\n` +
                                         `O sistema foi bloqueado instantaneamente.\n` +
                                         `Para reativar, adquira uma nova key e use:\n` +
                                         `**/ativar [key]**`,
                            footer: { text: 'Grind System • Security Check' }
                        };

                        if (interaction.isChatInputCommand() || interaction.isMessageComponent() || interaction.isModalSubmit()) {
                            if (!interaction.replied && !interaction.deferred) {
                                return interaction.reply({ embeds: [embedBloqueio], ephemeral: true });
                            }
                        }
                        return; // PARE TUDO AQUI.
                    }
                }
            }
            // ====================================================

            // 1. Comandos de Chat (Slash)
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (command) await command.execute(interaction);
                return;
            }

            // 2. Botões e Menus
            if (interaction.customId) {
                let handlerName = null;

                if (interaction.customId.startsWith('reg_')) handlerName = 'registrar';
                else if (interaction.customId.startsWith('ponto_')) handlerName = 'ponto';
                else if (interaction.customId.startsWith('cfg_')) handlerName = 'config';
                else if (interaction.customId.startsWith('vendas_')) handlerName = 'vendas';
                else if (interaction.customId.startsWith('farm_')) handlerName = 'farm';
                else if (interaction.customId.startsWith('acao_')) handlerName = 'acao';

                if (handlerName) {
                    try {
                        const handler = require(`../interactions/${handlerName}.js`);
                        await handler.execute(interaction);
                    } catch (error) {
                        console.error(`Erro no handler ${handlerName}:`, error);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: '❌ Ocorreu um erro interno.', ephemeral: true });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Erro fatal no interactionCreate:', error);
        }
    }
};
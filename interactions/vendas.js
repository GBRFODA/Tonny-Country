const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    async execute(interaction) {

        // ====================================================
        // 1. CLICOU EM "REGISTRAR VENDA" (NO PAINEL FIXO)
        // ====================================================
        if (interaction.isButton() && interaction.customId === 'vendas_btn_painel_iniciar') {
            const containerTipo = {
                type: 17, accent_color: 0x5865F2,
                components: [
                    { type: 10, content: `### 📂 Selecione o Tipo de Venda\nEscolha a categoria para ver os produtos e preços corretos.` },
                    { type: 14 },
                    { type: 1, components: [
                        { 
                            type: 2, style: 1, label: `Venda Normal`, 
                            custom_id: `vendas_btn_modo_normal`, emoji: { name: '💵' } 
                        },
                        { 
                            type: 2, style: 2, label: `Venda Parceira`, 
                            custom_id: `vendas_btn_modo_parceria`, emoji: { name: '🤝' } 
                        }
                    ]}
                ]
            };
            
            // Responde Ephemeral (Só pra ele ver)
            await interaction.reply({ components: [containerTipo], flags: (1<<15) | 64 });
        }

        // ====================================================
        // 2. ESCOLHEU O TIPO (NORMAL OU PARCERIA)
        // ====================================================
        if (interaction.isButton() && interaction.customId.startsWith('vendas_btn_modo_')) {
            const modo = interaction.customId.split('_')[3]; // 'normal' ou 'parceria'
            const produtos = db.listarProdutos();

            if (produtos.length === 0) {
                // Erro também precisa ser V2 se for update
                const containerErr = {
                    type: 17, accent_color: 0xFF0000,
                    components: [{ type: 10, content: '❌ **Erro:** Nenhum produto cadastrado no sistema.' }]
                };
                return interaction.update({ components: [containerErr], flags: (1<<15) });
            }

            // Cria opções do Select Menu mostrando o preço correto baseado no modo
            const options = produtos.slice(0, 25).map(p => {
                const preco = modo === 'parceria' ? p.price_partner : p.price_normal;
                return {
                    label: p.name,
                    description: `Valor: R$ ${preco}`,
                    value: p.id.toString(),
                    emoji: '📦'
                };
            });

            // Cria o Select Menu
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`vendas_select_prod_${modo}`)
                    .setPlaceholder('Selecione o produto...')
                    .addOptions(options)
            );

            const containerProd = {
                type: 17, accent_color: modo === 'parceria' ? 0xFFA500 : 0x00FF00,
                components: [
                    { type: 10, content: `# 🛒 Modo: ${modo === 'parceria' ? 'Parceria 🤝' : 'Normal 💵'}\nSelecione o produto vendido na lista abaixo.` }
                ]
            };

            await interaction.update({ components: [containerProd, row], flags: (1<<15) });
        }

        // ====================================================
        // 3. SELECIONOU O PRODUTO -> ABRE MODAL QUANTIDADE
        // ====================================================
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('vendas_select_prod_')) {
            const modo = interaction.customId.split('_')[3]; // 'normal' ou 'parceria'
            const prodId = interaction.values[0];

            // Modal ID: vendas_modal_final_IDPRODUTO_MODO
            const modal = new ModalBuilder()
                .setCustomId(`vendas_modal_final_${prodId}_${modo}`)
                .setTitle('Quantidade Vendida');

            const inputQtd = new TextInputBuilder()
                .setCustomId('in_qtd')
                .setLabel("Quantidade")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Ex: 1, 5, 100")
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(inputQtd));
            await interaction.showModal(modal);
        }

        // ====================================================
        // 4. ENVIOU O MODAL -> CALCULA E SALVA
        // ====================================================
        if (interaction.isModalSubmit() && interaction.customId.startsWith('vendas_modal_final_')) {
            const parts = interaction.customId.split('_');
            const prodId = parts[3];
            const modo = parts[4];
            
            const qtdStr = interaction.fields.getTextInputValue('in_qtd');
            const qtd = parseInt(qtdStr);

            if (isNaN(qtd) || qtd <= 0) {
                return interaction.reply({ content: '❌ Quantidade inválida.', flags: 64 });
            }

            // Busca dados para cálculo
            const produto = db.buscarProduto(prodId);
            const porcentagemConfig = db.getConfig('vendas_porcentagem') || "100";
            const porcentagem = parseFloat(porcentagemConfig) / 100;

            if (!produto) return interaction.reply({ content: 'Produto não encontrado (foi excluído?).', flags: 64 });

            // Cálculos
            const precoUnitario = modo === 'parceria' ? parseFloat(produto.price_partner) : parseFloat(produto.price_normal);
            const valorTotal = precoUnitario * qtd;
            const valorVendedor = valorTotal * porcentagem;

            const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            // 1. Salvar no Banco
            db.registrarVenda(
                interaction.user.id,
                produto.name,
                qtd,
                valorTotal,
                valorVendedor,
                modo === 'parceria'
            );

            // 2. Enviar Log no Canal
            const logId = db.getConfig('channel_logs_vendas');
            if (logId) {
                const canalLogs = interaction.guild.channels.cache.get(logId);
                if (canalLogs) {
                    const logContainer = {
                        type: 17, 
                        accent_color: modo === 'parceria' ? 0xFFA500 : 0x00FF00,
                        components: [
                            { type: 10, content: `### 🛒 Nova Venda Registrada` },
                            {
                                type: 9, // Section
                                components: [{
                                    type: 10,
                                    content: `📦 **Produto:** ${produto.name}\n` +
                                             `🔢 **Quantidade:** ${qtd}\n` +
                                             `🏷️ **Tipo:** ${modo === 'parceria' ? 'Parceria 🤝' : 'Normal 💵'}\n` +
                                             `💰 **Valor Total:** \`${fmt(valorTotal)}\`\n` +
                                             `🤑 **Comissão (${porcentagemConfig}%):** \`${fmt(valorVendedor)}\`\n` +
                                             `👤 **Vendedor:** ${interaction.user}\n` +
                                             `📅 **Data:** <t:${Math.floor(Date.now()/1000)}:f>`
                                }],
                                accessory: {
                                    type: 11, // Foto do vendedor
                                    media: { url: interaction.user.displayAvatarURL({ extension: 'png' }) }
                                }
                            }
                        ]
                    };
                    await canalLogs.send({ components: [logContainer], flags: (1<<15) });
                }
            }

            // 3. Feedback final para o vendedor (CORREÇÃO DO ERRO)
            // Usamos um Container V2 para manter a consistência da flag (1<<15)
            const feedbackContainer = {
                type: 17,
                accent_color: 0x00FF00, // Verde
                components: [
                    { type: 10, content: `### ✅ Venda Registrada com Sucesso!` },
                    { type: 10, content: `💰 **Valor Total:** ${fmt(valorTotal)}\n🤑 **Sua Parte:** ${fmt(valorVendedor)}` }
                ]
            };

            await interaction.update({ 
                components: [feedbackContainer], 
                flags: (1 << 15) | 64 
            });
        }
    }
};
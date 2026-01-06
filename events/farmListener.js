const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // ====================================================
        // 1. FILTRAGEM INICIAL
        // ====================================================
        
        // Ignora mensagens de outros bots para evitar loops
        if (message.author.bot) return;

        // Ignora mensagens sem anexos (imagens/vídeos/arquivos)
        // O farm só é registrado se tiver print comprovando
        if (message.attachments.size === 0) return;

        // ====================================================
        // 2. VERIFICAÇÃO DE CANAL
        // ====================================================
        
        // Verifica se o canal onde a mensagem foi enviada é uma "Sala de Farm" registrada no banco
        const sala = db.buscarSalaFarm(message.channel.id);
        
        // Se não for uma sala de farm, o bot ignora e não faz nada
        if (!sala) return;

        // ====================================================
        // 3. AÇÃO: SOLICITAR APROVAÇÃO
        // ====================================================
        
        // Busca qual cargo é responsável por aprovar (configurado no /config)
        const approverRole = db.getConfig('role_farm_approver');
        
        // Monta o Embed de Solicitação para a Gerência
        const embed = new EmbedBuilder()
            .setTitle('📸 Novo Registro de Farm Detectado')
            .setDescription(`O usuário ${message.author} enviou um anexo.\n\n**Instrução para a Gerência:**\n1. Verifique a imagem/print acima.\n2. Se estiver correto, clique em **Aprovar** para gerar o log.\n3. O ID Global será gerado automaticamente após a aprovação.`)
            .setColor('Yellow') // Amarelo = Pendente/Atenção
            .setFooter({ text: 'Aguardando validação...' })
            .setTimestamp();

        // Cria o botão de Aprovação
        // O ID do botão guarda o ID da mensagem original (farm_approve_IDMENSAGEM)
        // Isso permite que o bot saiba EXATAMENTE qual print baixar depois
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`farm_approve_${message.id}`) 
                .setLabel('Aprovar e Catalogar')
                .setStyle(ButtonStyle.Success) // Verde
                .setEmoji('✅')
        );

        // Prepara a menção do cargo (se existir)
        const content = approverRole ? `🔔 <@&${approverRole}>` : '🔔 **Atenção Gerência:**';
        
        // Responde à mensagem da print
        try {
            await message.reply({ 
                content: content, 
                embeds: [embed], 
                components: [row] 
            });
        } catch (err) {
            console.error(`Erro ao responder no farmListener (Canal: ${message.channel.id}):`, err);
        }
    },
};
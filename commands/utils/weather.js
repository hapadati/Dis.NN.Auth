import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import axios from 'axios';

export const data = new SlashCommandBuilder()
    .setName('weather')
    .setDescription('☀️ 指定した都市の現在の天気を表示します')
    .addStringOption(option =>
        option.setName('city')
            .setDescription('都市名 (例: Tokyo, Osaka, London)')
            .setRequired(true));

export async function execute(interaction) {
    try {
        await interaction.deferReply();

        const city = interaction.options.getString('city');
        const encodedCity = encodeURIComponent(city);

        // wttr.in API (JSON format)
        const response = await axios.get(`https://wttr.in/${encodedCity}?format=j1`, { timeout: 5000 });

        if (!response.data || !response.data.current_condition || response.data.current_condition.length === 0) {
            throw new Error('天気の取得に失敗しました');
        }

        const current = response.data.current_condition[0];
        const area = response.data.nearest_area[0];

        const locationName = `${area.areaName[0].value}, ${area.country[0].value}`;
        const tempC = current.temp_C;
        const feelsLikeC = current.FeelsLikeC;
        const humidity = current.humidity;
        const windKmph = current.windspeedKmph;
        const description = current.weatherDesc[0].value;
        const weatherIconUrl = current.weatherIconUrl[0].value;

        const embed = new EmbedBuilder()
            .setTitle(`☀️ ${locationName} の天気`)
            .setDescription(`**${description}**`)
            .addFields(
                { name: '🌡️ 気温', value: `${tempC}°C (体感: ${feelsLikeC}°C)`, inline: true },
                { name: '💧 湿度', value: `${humidity}%`, inline: true },
                { name: '💨 風速', value: `${windKmph} km/h`, inline: true }
            )
            .setThumbnail(weatherIconUrl)
            .setColor('#f1c40f')
            .setFooter({ text: 'Powered by wttr.in' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('[weather] Error:', error);
        if (interaction.deferred) {
            await interaction.editReply({ content: `❌ 「${interaction.options.getString('city')}」の天気情報を取得できませんでした。都市名が正しいか確認してください。` }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ エラーが発生しました。', flags: [MessageFlags.Ephemeral] }).catch(() => {});
        }
    }
}

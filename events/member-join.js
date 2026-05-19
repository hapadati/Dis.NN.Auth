import { EmbedBuilder } from 'discord.js';

/**
 * サーバー参加時DM送信
 * - 認証ページURL（Webクライアントの認証ページ）
 * - 再参加用の永続招待リンク
 */
export async function handleMemberJoin(member) {
    // Bot は無視
    if (member.user.bot) return;

    const guild = member.guild;
    const webUrl = process.env.WEB_URL || 'https://unl-web.onrender.com';
    const authUrl = `${webUrl}/auth/signin`;

    // ── 再参加用の永続招待リンク生成（既存のものを再利用 or 新規作成） ──
    let inviteUrl = null;
    try {
        const inviteChannel =
            guild.systemChannel ||
            guild.channels.cache.find(c => c.isTextBased() && !c.isThread() && c.permissionsFor(guild.members.me)?.has('CreateInstantInvite'));

        if (inviteChannel) {
            // 既存の永続招待（maxAge=0, maxUses=0）を探す
            const existingInvites = await inviteChannel.fetchInvites().catch(() => null);
            const permanent = existingInvites?.find(inv => inv.maxAge === 0 && inv.maxUses === 0 && !inv.temporary);

            if (permanent) {
                inviteUrl = permanent.url;
            } else {
                // なければ新規作成（期限なし・回数無制限）
                const newInvite = await inviteChannel.createInvite({
                    maxAge: 0,
                    maxUses: 0,
                    temporary: false,
                    unique: false,
                    reason: 'Auto permanent invite for member DM',
                });
                inviteUrl = newInvite.url;
            }
        }
    } catch (e) {
        console.warn('[MemberJoin] 招待リンク生成失敗:', e.message);
    }

    // ── DM送信 ──
    const embed = new EmbedBuilder()
        .setTitle(`✨ ${guild.name} へようこそ！`)
        .setColor(0x6366f1)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .setDescription(
            `こんにちは、**${member.user.username}** さん！\n` +
            `**${guild.name}** へのご参加ありがとうございます 🎉\n\n` +
            `以下のリンクからアカウントを認証して、サーバーのすべての機能を解放しましょう！`
        )
        .addFields(
            {
                name: '🔑 認証 / ダッシュボード',
                value: `[こちらからログイン / 認証を行ってください](${authUrl})\n> DiscordアカウントでサインインするだけでOKです！`,
                inline: false,
            },
            {
                name: '📊 できること',
                value:
                    '• ポイント・ランキングの確認\n' +
                    '• ガチャ・ショップ・マーケットの利用\n' +
                    '• クエスト・実績の達成\n' +
                    '• ギャンブルゲーム・大富豪などのプレイ',
                inline: false,
            }
        )
        .setFooter({ text: `${guild.name} • 認証しない場合、一部機能が制限される場合があります` })
        .setTimestamp();

    // 招待リンクフィールドを追加
    if (inviteUrl) {
        embed.addFields({
            name: '🔗 サーバー再参加リンク（永続）',
            value: `万が一サーバーから退出してしまった場合は以下からいつでも戻れます：\n${inviteUrl}`,
            inline: false,
        });
    }

    try {
        await member.user.send({ embeds: [embed] });
        console.log(`[MemberJoin] DM送信成功: ${member.user.tag}`);
    } catch (err) {
        // DMを受け取れない設定 of ユーザーはスキップ（エラーではない）
        if (err.code === 50007) {
            console.log(`[MemberJoin] DM不可ユーザー（無視）: ${member.user.tag}`);
        } else {
            console.error(`[MemberJoin] DM送信エラー: ${member.user.tag}`, err.message);
        }
    }

    // ── ウェルカムチャンネルへの挨拶メッセージ（任意） ──
    const welcomeChannel =
        guild.systemChannel ||
        guild.channels.cache.find(c =>
            c.isTextBased() &&
            !c.isThread() &&
            (c.name.includes('welcome') || c.name.includes('歓迎') || c.name.includes('ようこそ'))
        );

    if (welcomeChannel) {
        try {
            await welcomeChannel.send({
                content: `🎉 <@${member.user.id}> さんが **${guild.name}** に参加しました！ ようこそ！`,
            });
        } catch (e) {
            // 送信失敗は無視
        }
    }
}

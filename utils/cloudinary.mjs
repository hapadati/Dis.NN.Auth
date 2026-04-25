import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

// Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * 画像をCloudinaryにアップロードする
 * @param {string} url Discordの画像URL
 * @param {string} folder 保存先フォルダ
 * @returns {Promise<string|null>} アップロード後のURL
 */
export async function uploadImage(url, folder = 'discord-logs') {
  try {
    const result = await cloudinary.uploader.upload(url, {
      folder: folder,
      resource_type: 'auto',
    });
    return result.secure_url;
  } catch (error) {
    console.error('[Cloudinary] Upload failed:', error.message);
    return null;
  }
}

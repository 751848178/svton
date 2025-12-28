import Taro from '@tarojs/taro';

// API 基础 URL（从 Taro 配置文件注入）
declare const API_BASE_URL: string;

export interface UploadResult {
  url: string;
}

export async function uploadImage(filePath: string): Promise<UploadResult> {
  const token = Taro.getStorageSync('token');

  const res = await Taro.uploadFile({
    url: `${API_BASE_URL}/upload/image`,
    filePath,
    name: 'file',
    header: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  if (res.statusCode !== 200 && res.statusCode !== 201) {
    throw new Error(`上传失败: ${res.statusCode}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(res.data);
  } catch {
    parsed = res.data;
  }

  if (parsed && typeof parsed === 'object' && 'code' in parsed) {
    if (parsed.code !== 200) {
      throw new Error(parsed.message || '上传失败');
    }
    return { url: parsed.data?.url };
  }

  return { url: parsed?.url };
}

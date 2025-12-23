import { View } from '@tarojs/components';
import { useState } from 'react';
import { usePersistFn, useMount } from '@svton/hooks';
import { NavBar, StatusBar, Loading, Empty } from '@svton/taro-ui';
import type { ContentVo } from '{{ORG_NAME}}/types';
import './index.scss';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [contents, setContents] = useState<ContentVo[]>([]);

  const fetchContents = usePersistFn(async () => {
    try {
      setLoading(true);
      // 这里应该使用 @svton/api-client 的 API
      // const response = await apiClient.contents.list({ page: 1, pageSize: 10 });
      // setContents(response.data.list);
      
      // 模拟数据
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setContents([]);
    } catch (error) {
      console.error('获取内容列表失败', error);
    } finally {
      setLoading(false);
    }
  });

  useMount(() => {
    fetchContents();
  });

  return (
    <View className="index">
      <StatusBar />
      <NavBar title="首页" />
      
      <View className="content">
        {loading && <Loading text="加载中..." />}
        {!loading && contents.length === 0 && <Empty text="暂无内容" />}
        {!loading && contents.length > 0 && (
          <View className="content-list">
            {/* 内容列表 */}
          </View>
        )}
      </View>
    </View>
  );
}

import Taro, { usePullDownRefresh as useTaroPullDownRefresh } from '@tarojs/taro';
import { usePersistFn } from '@svton/hooks';

type RefreshFn = () => void | Promise<void>;

export function usePullDownRefresh(onRefresh: RefreshFn) {
  const onRefreshPersist = usePersistFn(onRefresh);

  useTaroPullDownRefresh(async () => {
    try {
      await onRefreshPersist();
    } finally {
      Taro.stopPullDownRefresh();
    }
  });
}

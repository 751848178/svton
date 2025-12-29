import { useReachBottom as useTaroReachBottom } from '@tarojs/taro';
import { usePersistFn } from '@svton/hooks';

type ReachBottomFn = () => void | Promise<void>;

export function useReachBottom(onReachBottom: ReachBottomFn) {
  const onReachBottomPersist = usePersistFn(onReachBottom);

  useTaroReachBottom(() => {
    void onReachBottomPersist();
  });
}

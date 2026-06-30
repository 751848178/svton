/**
 * Modal 包装组件
 *
 * 包装 @svton/ui 的 Modal，规避 React 19 类型下 ForwardRefExoticComponent
 * 跨包解析时的 JSX 元素类型校验差异（TS2786）。
 *
 * 根因：@svton/ui 构建产物的 .d.ts 将 Modal 声明为 React.ForwardRefExoticComponent，
 * 在 React 19 + workspace 跨包消费时，其 ReactNode 类型标识与 devpilot-web 不一致，
 * 导致 JSX 校验失败。此处用类型断言归一化为普通函数组件签名。
 *
 * 单一职责：透传 props，归一化类型。行为与 @svton/ui Modal 完全一致。
 */

import { Modal as UiModal, type ModalProps } from '@svton/ui';

export type { ModalProps };

// 断言为普通函数组件，绕过跨包 ForwardRefExoticComponent 类型标识差异
const ModalComponent = UiModal as unknown as (props: ModalProps) => JSX.Element;

export function Modal(props: ModalProps) {
  return <ModalComponent {...props} />;
}

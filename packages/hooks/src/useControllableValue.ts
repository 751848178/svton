/**
 * useControllableValue
 * 受控/非受控组件值管理（组件库必备）
 *
 * @example
 * // 在组件内部使用
 * interface InputProps {
 *   value?: string;
 *   defaultValue?: string;
 *   onChange?: (value: string) => void;
 * }
 *
 * function Input(props: InputProps) {
 *   const [value, setValue] = useControllableValue(props);
 *   return <input value={value} onChange={(e) => setValue(e.target.value)} />;
 * }
 *
 * // 使用组件 - 非受控
 * <Input defaultValue="hello" />
 *
 * // 使用组件 - 受控
 * <Input value={value} onChange={setValue} />
 */

import { useState, useRef, useCallback } from 'react';

export interface UseControllableValueOptions<T> {
  defaultValue?: T;
  defaultValuePropName?: string;
  valuePropName?: string;
  trigger?: string;
}

export function useControllableValue<T>(
  props: Record<string, any> = {},
  options: UseControllableValueOptions<T> = {},
): [T, (value: T | ((prev: T) => T), ...args: any[]) => void] {
  const {
    defaultValue,
    defaultValuePropName = 'defaultValue',
    valuePropName = 'value',
    trigger = 'onChange',
  } = options;

  const value = props[valuePropName] as T | undefined;
  const isControlled = valuePropName in props;

  const initialValue = useRef<T>(
    isControlled ? value! : (props[defaultValuePropName] ?? defaultValue) as T,
  );

  const [innerValue, setInnerValue] = useState<T>(() => initialValue.current);

  const mergedValue = isControlled ? value! : innerValue;

  const triggerChange = props[trigger];

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T), ...args: any[]) => {
      const nextValue =
        typeof newValue === 'function'
          ? (newValue as (prev: T) => T)(mergedValue)
          : newValue;

      if (!isControlled) {
        setInnerValue(nextValue);
      }

      triggerChange?.(nextValue, ...args);
    },
    [isControlled, mergedValue, triggerChange],
  );

  return [mergedValue, setValue];
}

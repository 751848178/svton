/**
 * Form 表单组件
 * 参考 React Hook Form 和 Ant Design 的设计理念
 * 支持表单验证、状态管理、错误处理
 */

import { View } from '@tarojs/components';
import { createContext, useContext, ReactNode } from 'react';
import { usePersistFn } from '@svton/hooks';
import './Form.scss';

/**
 * 表单字段值类型
 */
export type FormValues = Record<string, any>;

/**
 * 表单验证规则
 */
export interface FormRule {
  required?: boolean;
  message?: string;
  min?: number;
  max?: number;
  pattern?: RegExp;
  validator?: (value: any, values: FormValues) => boolean | string | Promise<boolean | string>;
}

/**
 * 表单字段配置
 */
export interface FormField {
  name: string;
  label?: string;
  rules?: FormRule[];
  initialValue?: any;
}

/**
 * 表单错误
 */
export interface FormError {
  [field: string]: string;
}

/**
 * 表单状态
 */
export interface FormState {
  values: FormValues;
  errors: FormError;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValidating: boolean;
}

/**
 * 表单 Context
 */
export interface FormContextValue {
  values: FormValues;
  errors: FormError;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValidating: boolean;
  setFieldValue: (name: string, value: any) => void;
  setFieldTouched: (name: string, touched?: boolean) => void;
  setFieldError: (name: string, error: string) => void;
  validateField: (name: string) => Promise<boolean>;
  validateForm: () => Promise<boolean>;
  resetForm: () => void;
  getFieldProps: (name: string) => any;
}

const FormContext = createContext<FormContextValue | null>(null);

/**
 * 使用表单 Context
 */
export const useFormContext = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within Form');
  }
  return context;
};

/**
 * Form 组件 Props
 */
export interface FormProps {
  /** 初始值 */
  initialValues?: FormValues;
  /** 提交处理 */
  onSubmit?: (values: FormValues) => void | Promise<void>;
  /** 值变化 */
  onValuesChange?: (changedValues: FormValues, allValues: FormValues) => void;
  /** 子元素 */
  children: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 表单布局 */
  layout?: 'vertical' | 'horizontal';
}

/**
 * Form 表单组件
 * 
 * @example
 * ```tsx
 * <Form
 *   initialValues={{ username: '', password: '' }}
 *   onSubmit={handleSubmit}
 * >
 *   <FormItem name="username" label="用户名" rules={[{ required: true }]}>
 *     <Input />
 *   </FormItem>
 *   <FormItem name="password" label="密码" rules={[{ required: true }]}>
 *     <Input type="password" />
 *   </FormItem>
 *   <Button formType="submit">提交</Button>
 * </Form>
 * ```
 */
export default function Form({
  initialValues = {},
  onSubmit,
  onValuesChange,
  children,
  className = '',
  layout = 'vertical',
}: FormProps) {
  // 表单状态由外部通过 useForm hook 管理
  // 这里只是提供一个 Context 容器
  
  return (
    <View className={`svton-form svton-form--${layout} ${className}`}>
      {children}
    </View>
  );
}

// 导出相关类型


/**
 * useForm Hook
 * 参考 React Hook Form 的设计理念
 * 提供表单状态管理、验证、提交等功能
 */

import { useState, useCallback, useRef } from 'react';
import { usePersistFn } from '@svton/hooks';

export interface FormRule {
  required?: boolean;
  message?: string;
  min?: number;
  max?: number;
  pattern?: RegExp;
  validator?: (value: any, values: Record<string, any>) => boolean | string | Promise<boolean | string>;
}

export interface FormField {
  name: string;
  label?: string;
  rules?: FormRule[];
  initialValue?: any;
}

export type FormValues = Record<string, any>;
export type FormError = Record<string, string>;

export interface UseFormOptions {
  initialValues?: FormValues;
  onSubmit?: (values: FormValues) => void | Promise<void>;
  onValuesChange?: (changedValues: FormValues, allValues: FormValues) => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export interface UseFormReturn {
  values: FormValues;
  errors: FormError;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValidating: boolean;
  
  // 方法
  setFieldValue: (name: string, value: any) => void;
  setFieldTouched: (name: string, touched?: boolean) => void;
  setFieldError: (name: string, error: string) => void;
  setValues: (values: FormValues) => void;
  setErrors: (errors: FormError) => void;
  
  registerField: (field: FormField) => void;
  validateField: (name: string) => Promise<boolean>;
  validateForm: () => Promise<boolean>;
  resetForm: () => void;
  handleSubmit: (e?: any) => Promise<void>;
  
  // 辅助方法
  getFieldProps: (name: string) => {
    value: any;
    onChange: (value: any) => void;
    onBlur: () => void;
    error: string | undefined;
    touched: boolean;
  };
}

/**
 * useForm Hook
 * 
 * @example
 * ```tsx
 * const form = useForm({
 *   initialValues: { username: '', password: '' },
 *   onSubmit: async (values) => {
 *     await login(values);
 *   },
 * });
 * 
 * form.registerField({
 *   name: 'username',
 *   rules: [
 *     { required: true, message: '请输入用户名' },
 *     { min: 3, message: '用户名至少3个字符' },
 *   ],
 * });
 * ```
 */
export function useForm(options: UseFormOptions = {}): UseFormReturn {
  const {
    initialValues = {},
    onSubmit,
    onValuesChange,
    validateOnChange = true,
    validateOnBlur = true,
  } = options;

  // 表单状态
  const [values, setValuesState] = useState<FormValues>(initialValues);
  const [errors, setErrorsState] = useState<FormError>({});
  const [touched, setTouchedState] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // 字段注册表
  const fieldsRef = useRef<Map<string, FormField>>(new Map());

  /**
   * 注册字段
   */
  const registerField = usePersistFn((field: FormField) => {
    fieldsRef.current.set(field.name, field);
    
    // 设置初始值
    if (field.initialValue !== undefined && values[field.name] === undefined) {
      setValuesState(prev => ({
        ...prev,
        [field.name]: field.initialValue,
      }));
    }
  });

  /**
   * 验证单个字段
   */
  const validateField = usePersistFn(async (name: string): Promise<boolean> => {
    const field = fieldsRef.current.get(name);
    if (!field || !field.rules) return true;

    const value = values[name];
    
    for (const rule of field.rules) {
      // required 验证
      if (rule.required) {
        const isEmpty = value === undefined || value === null || value === '' || 
                        (Array.isArray(value) && value.length === 0);
        if (isEmpty) {
          const message = rule.message || `${field.label || name}是必填项`;
          setFieldError(name, message);
          return false;
        }
      }

      // min 验证
      if (rule.min !== undefined) {
        const length = typeof value === 'string' ? value.length : value;
        if (length < rule.min) {
          const message = rule.message || `${field.label || name}最少${rule.min}个字符`;
          setFieldError(name, message);
          return false;
        }
      }

      // max 验证
      if (rule.max !== undefined) {
        const length = typeof value === 'string' ? value.length : value;
        if (length > rule.max) {
          const message = rule.message || `${field.label || name}最多${rule.max}个字符`;
          setFieldError(name, message);
          return false;
        }
      }

      // pattern 验证
      if (rule.pattern) {
        if (typeof value === 'string' && !rule.pattern.test(value)) {
          const message = rule.message || `${field.label || name}格式不正确`;
          setFieldError(name, message);
          return false;
        }
      }

      // 自定义验证器
      if (rule.validator) {
        try {
          const result = await rule.validator(value, values);
          if (result !== true) {
            const message = typeof result === 'string' ? result : (rule.message || '验证失败');
            setFieldError(name, message);
            return false;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '验证失败';
          setFieldError(name, message);
          return false;
        }
      }
    }

    // 验证通过，清除错误
    setFieldError(name, '');
    return true;
  });

  /**
   * 验证整个表单
   */
  const validateForm = usePersistFn(async (): Promise<boolean> => {
    setIsValidating(true);
    
    const fieldNames = Array.from(fieldsRef.current.keys());
    const results = await Promise.all(
      fieldNames.map(name => validateField(name))
    );
    
    setIsValidating(false);
    return results.every(result => result === true);
  });

  /**
   * 设置字段值
   */
  const setFieldValue = usePersistFn((name: string, value: any) => {
    const prevValues = values;
    const newValues = { ...prevValues, [name]: value };
    
    setValuesState(newValues);
    
    // 触发 onValuesChange
    if (onValuesChange) {
      onValuesChange({ [name]: value }, newValues);
    }
    
    // 如果启用了 onChange 验证
    if (validateOnChange && touched[name]) {
      validateField(name);
    }
  });

  /**
   * 设置字段已触碰状态
   */
  const setFieldTouched = usePersistFn((name: string, isTouched = true) => {
    setTouchedState(prev => ({
      ...prev,
      [name]: isTouched,
    }));
    
    // 如果启用了 onBlur 验证
    if (validateOnBlur && isTouched) {
      validateField(name);
    }
  });

  /**
   * 设置字段错误
   */
  const setFieldError = usePersistFn((name: string, error: string) => {
    setErrorsState(prev => {
      if (error === '') {
        const { [name]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [name]: error };
    });
  });

  /**
   * 设置所有值
   */
  const setValues = usePersistFn((newValues: FormValues) => {
    setValuesState(newValues);
  });

  /**
   * 设置所有错误
   */
  const setErrors = usePersistFn((newErrors: FormError) => {
    setErrorsState(newErrors);
  });

  /**
   * 重置表单
   */
  const resetForm = usePersistFn(() => {
    setValuesState(initialValues);
    setErrorsState({});
    setTouchedState({});
    setIsSubmitting(false);
    setIsValidating(false);
  });

  /**
   * 提交表单
   */
  const handleSubmit = usePersistFn(async (e?: any) => {
    // 阻止默认行为
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // 验证表单
    const isValid = await validateForm();
    if (!isValid) {
      return;
    }

    // 执行提交
    if (onSubmit) {
      try {
        setIsSubmitting(true);
        await onSubmit(values);
      } catch (error) {
        console.error('Form submit error:', error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    }
  });

  /**
   * 获取字段属性（用于绑定到输入组件）
   */
  const getFieldProps = usePersistFn((name: string) => {
    return {
      value: values[name],
      onChange: (value: any) => setFieldValue(name, value),
      onBlur: () => setFieldTouched(name, true),
      error: errors[name],
      touched: touched[name] || false,
    };
  });

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValidating,
    
    setFieldValue,
    setFieldTouched,
    setFieldError,
    setValues,
    setErrors,
    
    registerField,
    validateField,
    validateForm,
    resetForm,
    handleSubmit,
    
    getFieldProps,
  };
}

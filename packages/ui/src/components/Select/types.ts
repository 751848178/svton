export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export type SelectOptionFilter =
  | boolean
  | ((option: SelectOption, input: string) => boolean);

export type SelectOnChangeValue = string | string[];

/** 与原生 <select onChange> 对齐的合成事件形态。 */
export interface SelectChangeEvent {
  target: {
    value: SelectOnChangeValue;
  };
  currentTarget: {
    value: SelectOnChangeValue;
  };
}

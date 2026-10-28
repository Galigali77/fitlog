import { useState } from 'react';

/**
 * 数字输入框（修复受控 number 输入吞小数点的问题）
 * 受控 value + onChange 里 parseFloat 时，键入「22.」会被立即 parse 成 22 回显，小数点被吞；
 * 且 type=number 的输入框无法程序性回显「22.」这类中间态（HTML 规范会 sanitize 成空串）。
 * 因此本组件在 focus 时接管为内部字符串态，编辑期间原样保留「22.」等合法中间态，
 * blur（或回车）时才 parse 提交。
 * @param {{ value: number|null, onCommit: (n: number|null) => void, integer?: boolean }} props
 *   value    已提交的数值；null/0 显示为空（配合 placeholder）
 *   onCommit blur 时回调：合法输入提交数值，空输入提交 null，非法输入不提交（回显旧值）
 *   integer  true 时按 parseInt 提交（次数等整数场景）
 * 其余 input 属性（inputMode、className、placeholder 等）透传。
 */
export default function NumberField({ value, onCommit, integer = false, onFocus, onBlur, onKeyDown, ...rest }) {
  const [text, setText] = useState(null); // null = 未聚焦，显示外部值

  const commit = (raw) => {
    setText(null);
    const trimmed = raw.trim();
    if (trimmed === '') {
      onCommit(null);
      return;
    }
    const n = integer ? parseInt(trimmed, 10) : parseFloat(trimmed);
    if (Number.isFinite(n)) onCommit(n);
  };

  return (
    <input
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      {...rest}
      value={text ?? (value || '')}
      onFocus={(e) => {
        setText(e.target.value);
        onFocus?.(e);
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => {
        commit(e.target.value);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        onKeyDown?.(e);
      }}
    />
  );
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  export const Tooltip: import('react').ComponentType<{
    label: string
    side?: 'bottom' | 'top' | 'left' | 'right'
    delayMs?: number
    children?: import('react').ReactElement
  }>
}

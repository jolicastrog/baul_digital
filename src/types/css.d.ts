// Declaraciones de tipos para importaciones de archivos CSS
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

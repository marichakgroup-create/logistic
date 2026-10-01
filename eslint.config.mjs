import ts from 'typescript-eslint';
export default ts.config({ignores:['**/.next/**','**/dist/**','**/node_modules/**','**/public/maplibre/**','**/next-env.d.ts']}, ...ts.configs.recommended);

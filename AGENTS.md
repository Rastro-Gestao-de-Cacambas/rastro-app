# Regras do projeto (rastro-app)

Consulte este arquivo antes de mexer em código deste projeto.

## Nunca importe `Text`/`TextInput` direto do `react-native`

Use sempre os wrappers de [src/components/AppText.tsx](src/components/AppText.tsx):

```ts
import { AppText as Text, AppTextInput as TextInput } from '@/components/AppText';
```

**Por quê:** o RN 0.81 mudou `Text`/`TextInput` de classe para function component, e o
React 19 parou de ler `defaultProps` em function components. Isso quebrou (em silêncio,
sem warning) um hack antigo do projeto que tentava forçar fonte padrão (`Inter_400Regular`)
e `allowFontScaling={false}` globalmente via `Text.defaultProps` em `_layout.tsx`.

Sintoma real que isso já causou em produção: em celulares com "Tamanho da fonte" do
Android configurado acima do padrão, textos sem `fontFamily` explícito no style cresciam
além do esperado e tinham a última palavra cortada (ex: "Lembrar CPF e sessão" virava
"Lembrar CPF e "). Não reproduzia no emulador porque o emulador roda com escala de fonte
padrão (100%).

O `AppText`/`AppTextInput` aplica esses defaults por instância (via props), o que
funciona de verdade e é o padrão recomendado pela própria documentação do React Native
para fonte padrão global — ao contrário de mutar `defaultProps`, que é frágil e já quebrou
uma vez sem aviso nenhum.

Se `import { Text } from 'react-native'` aparecer em uma tela nova, é bug: troque para o
wrapper acima.

## Pesos de fonte (Inter)

A fonte Inter é carregada como arquivos estáticos por peso (`Inter_400Regular`,
`Inter_600SemiBold`, `Inter_700Bold`), não como fonte variável. Isso significa que
`fontWeight: 'bold'` ou `fontWeight: '600'` **não tem efeito** nela. Para deixar um texto
mais grosso, troque o `fontFamily` para o peso desejado, nunca use `fontWeight`.

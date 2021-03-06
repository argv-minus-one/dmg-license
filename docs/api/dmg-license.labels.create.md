<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [dmg-license](./dmg-license.md) &gt; [Labels](./dmg-license.labels.md) &gt; [create](./dmg-license.labels.create.md)

## Labels.create() function

<b>Signature:</b>

```typescript
function create<T>(fun: (key: keyof Labels, index: number) => T, options: CreateOptions & {
        includeLanguageName: true;
    }): Labels.WithLanguageName<T>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  fun | <code>(key: keyof Labels, index: number) =&gt; T</code> |  |
|  options | <code>CreateOptions &amp; {</code><br/><code>        includeLanguageName: true;</code><br/><code>    }</code> |  |

<b>Returns:</b>

`Labels.WithLanguageName<T>`


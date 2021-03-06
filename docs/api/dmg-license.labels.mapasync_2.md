<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [dmg-license](./dmg-license.md) &gt; [Labels](./dmg-license.labels.md) &gt; [mapAsync](./dmg-license.labels.mapasync_2.md)

## Labels.mapAsync() function

<b>Signature:</b>

```typescript
function mapAsync<T, U>(labels: Labels<T>, fun: (label: T, key: keyof Labels, labels: Labels<T>) => Promise<U>, options: MapOptions<T, Promise<U>> & {
        onNoLanguageName(): Promise<U>;
    }): Promise<Labels.WithLanguageName<U>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  labels | <code>Labels&lt;T&gt;</code> |  |
|  fun | <code>(label: T, key: keyof Labels, labels: Labels&lt;T&gt;) =&gt; Promise&lt;U&gt;</code> |  |
|  options | <code>MapOptions&lt;T, Promise&lt;U&gt;&gt; &amp; {</code><br/><code>        onNoLanguageName(): Promise&lt;U&gt;;</code><br/><code>    }</code> |  |

<b>Returns:</b>

`Promise<Labels.WithLanguageName<U>>`


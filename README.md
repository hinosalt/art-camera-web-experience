# カメラアート体験

ブラウザのカメラ映像を使い、外部AI APIを使わずにリアルタイムでアート変換を行うミニ実験です。

## GitHub Pagesで公開

1. リポジトリの Settings > Pages を開く
2. Source を `GitHub Actions` に変更する
3. `main` へ push すると自動でデプロイが走る

公開URL（初回反映後）

- `https://hinosalt.github.io/art-camera-web-experience/`

## ローカル起動

```bash
python3 -m http.server 4173
```

ブラウザで `http://127.0.0.1:4173/` を開き、
「カメラを許可して開始」を押してください。

# 時間と天候で揺れるオーロライメージ

現在の日時・天候（取得可能な場合）を元に
毎秒ゆっくり変化する生成アートを表示します。

公開URL: https://hinosalt.github.io/time-weather-aurora/

## ローカル起動

```bash
python3 -m http.server 4173
```

ブラウザで `http://127.0.0.1:4173/` を開いてください。

## 表現

- 時間帯（昼/夜/季節）
- 曜日・日付（季節）
- 天気（天気コード）
- カーソル（当てる／ドラッグ）による有機的な流れの誘導
- 変換中に参照する変数を画面上で可視化（weatherFactor / windBias / tempBias / dayProgress / cursorSignal）

をもとに、刺激を抑えたゆったりしたオーロラ調の描画で変化させます。

## GitHub Pages

GitHub Pages の Workflow が `main` ブランチへ push された内容を公開します。
- URL: https://hinosalt.github.io/time-weather-aurora/
- 反映されるまで数十秒～数分かかる場合があります。

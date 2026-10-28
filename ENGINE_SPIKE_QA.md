# Phaser 4 エンジン導入技術ゲート G0（2026-10-28）
対象作業ツリー: feature/phaser-native-game / OshikatsuPhaserEngine
既存公開版(main)への変更: なし

## 内容
- Phaser v4.2.1 を npm でインストール。
- engine-lab.html と src/engine-lab.ts に、12都市のゲームデータと実ゲームロジック（newGame / applyAction / routeBetween / CITY_MAP / ROUTES）を読み込む独立Phaserシーンを作成。
- Canvas描画、クリック/タッチ選択、プレイヤーコマの経路移動Tween、到着演出、資金・AP・体力・週のHUD、仕事・翌週・リセットに対応。
- 現行版とは別の localStorage キーで保存（実験用）。エンジンからゲーム状態を直接改変しないで、旧来の pure TypeScript アクション処理だけを使用。
- 技術試作の島形・キャラは簡易な自作図形。**本格ゲームのアセット品質を示すものではない。** 正式版ではオリジナルスプライト・背景・カード・音・演出を制作する。
- Viteはindex.htmlとengine-lab.htmlのマルチページビルド。公開中のmainのGitHub Pagesは影響なし。

## 実測した操作
- iPhone想定390x844のChromium/EdgeブラウザでPhaser Canvas描画(約374x710)とHTTP200を確認。
- 12都市ゲームデータから福岡→広島への移動を実操作で検証: AP 4→3 / 60,000円→51,000円。描画コマの実移動あり。
- 仕事を実操作: AP 3→1 / 51,000円→73,000円。
- 次週へ進める: 週1→2、AP 4復活、所持金75,000円。全て元のゲームロジックによる。
- ページエラー・Console errorなし。Playwrightスクリプト scripts/phaser-lab-smoke.mjs で再現可能。
- ビルド成功 (engine-lab.htmlがdistに存在)、既存単体テスト114件合格。大きいPhaser bundleは本格版での分割/動的ロードを検討。
- iOS Safari実機ではまだ試していない。

## G0の判断
Phaser 4と現行TypeScriptルールエンジンを接続し、スマホ幅の2Dゲームシーンで実際にアクション/アニメ/状態変化を行う基本的な技術的成立性を確認。
この時点では**ゲーム自体の完成・品質向上を立証したものではない**。次に本格的なアート/スプライト/ステージ/カード対戦を入れた縦断スライスを実装し、従来版との差を人間にテストプレイしてもらう。開発担当Claude Code、独立検証Codexの本線に戻す。

## Codex静的レビューで発見・修正
最初のレビューはFAIL: (1) 移動Tween中にリセットするとSceneインスタンスのmovingフラグが残る、(2) 保存データの形式検証が甘く破損保存で起動不能。Scene.createの先頭でmoving=falseに戻し、保存読み込み時は既存のvalidateStateを使用する形へ修正。Playwrightで両ケースを再現し、修正後の成功を確認（scripts/phaser-lab-edgecases.mjs）。最初のFAILは修正前の監査結果であり、監査済みと主張する時はこの修正を前提にする。

import { writeFile } from 'node:fs/promises';

const indexUrl =
  'https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/csv/loto6.csv';

try {
  // ==============================
  // ① 一覧CSVを取得
  // ==============================

  const indexResponse = await fetch(indexUrl);

  if (!indexResponse.ok) {
    throw new Error(
      `一覧CSV取得失敗: ${indexResponse.status} ${indexResponse.statusText}`
    );
  }

  const indexBuffer = await indexResponse.arrayBuffer();
  const decoder = new TextDecoder('shift_jis');
  const indexCsv = decoder.decode(indexBuffer);

  // 最新回号を取得
  const latestMatch = indexCsv.match(/第(\d+)回ロト６/);

  if (!latestMatch) {
    throw new Error('最新回号を取得できませんでした');
  }

  const latestDrawNumber = Number(latestMatch[1]);
  const latestDrawNumberText =
    String(latestDrawNumber).padStart(4, '0');

  console.log('latest draw number:', latestDrawNumber);

  // ==============================
  // ② 詳細CSVのURLを生成
  // ==============================

  const detailUrl =
    `https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/csv/A102${latestDrawNumberText}.CSV`;

  console.log('detail url:', detailUrl);

  // ==============================
  // ③ 詳細CSVを取得
  // ==============================

  const detailResponse = await fetch(detailUrl);

  if (!detailResponse.ok) {
    throw new Error(
      `詳細CSV取得失敗: ${detailResponse.status} ${detailResponse.statusText}`
    );
  }

  const detailBuffer = await detailResponse.arrayBuffer();
  const detailCsv = decoder.decode(detailBuffer);

  // ==============================
  // ④ CSVを行・列に分解
  // ==============================

  const lines = detailCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const rows = lines.map((line) => line.split(','));

  // ==============================
  // ⑤ 抽せん情報
  // ==============================

  const drawInfo = rows[1];

  const drawNumber = Number(
    drawInfo[0].match(/第(\d+)回/)[1]
  );

  function parseJapaneseDate(text) {
    const match = text.match(
      /令和(\d+)年(\d+)月(\d+)日/
    );

    if (!match) {
      throw new Error(
        `日付を解析できません: ${text}`
      );
    }

    const year = Number(match[1]) + 2018;
    const month = String(Number(match[2])).padStart(2, '0');
    const day = String(Number(match[3])).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  const drawDate = parseJapaneseDate(drawInfo[2]);

  // ==============================
  // ⑥ 本数字・ボーナス数字
  // ==============================

  const numberInfo = rows[3];

  const winningNumbers = numberInfo
    .slice(1, 7)
    .map(Number);

  const bonusNumber = Number(numberInfo[8]);

  // ==============================
  // ⑦ 各等の賞金
  // ==============================

  function parsePrize(row) {
    if (row[1] === '該当なし') {
      return 0;
    }

    return Number(
      row[2].replace('円', '')
    );
  }

  const prize1 = parsePrize(rows[4]);
  const prize2 = parsePrize(rows[5]);
  const prize3 = parsePrize(rows[6]);
  const prize4 = parsePrize(rows[7]);
  const prize5 = parsePrize(rows[8]);

  // ==============================
  // ⑧ キャリーオーバー・販売実績額
  // ==============================

  const carryOver = Number(
    rows[9][1].replace('円', '')
  );

  const salesAmount = Number(
    rows[10][1].replace('円', '')
  );

  // ==============================
  // ⑨ 最終結果
  // ==============================

  const result = {
    draw_number: drawNumber,
    draw_date: drawDate,
    winning_numbers: winningNumbers,
    bonus_number: bonusNumber,
    prize_1: prize1,
    prize_2: prize2,
    prize_3: prize3,
    prize_4: prize4,
    prize_5: prize5,
    carry_over: carryOver,
    sales_amount: salesAmount,
  };

  // ==============================
  // ⑩ 回号別JSONとして保存
  // ==============================

  const outputPath = `./data/${drawNumber}.json`;

  await writeFile(
    outputPath,
    JSON.stringify(result, null, 2),
    'utf8'
  );

  console.log('\nJSONファイルを保存しました:');
  console.log(outputPath);

  // ==============================
  // ⑪ 最新結果JSONとして保存
  // ==============================

  const latestOutputPath = './data/latest.json';

  await writeFile(
    latestOutputPath,
    JSON.stringify(result, null, 2),
    'utf8'
  );

  console.log('最新結果JSONを保存しました:');
  console.log(latestOutputPath);

} catch (error) {
  console.error('error:', error);
}
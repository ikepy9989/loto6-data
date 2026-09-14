import { mkdir, writeFile } from 'node:fs/promises';

const indexUrl =
  'https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/csv/loto6.csv';

const baseUrl =
  'https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/csv';

const decoder = new TextDecoder('shift_jis');

function parseJapaneseDate(text) {
  const match = text.match(
    /令和(\d+)年(\d+)月(\d+)日/
  );

  if (!match) {
    throw new Error(`日付を解析できません: ${text}`);
  }

  const year = Number(match[1]) + 2018;
  const month = String(Number(match[2])).padStart(2, '0');
  const day = String(Number(match[3])).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parsePrize(row) {
  if (row[1] === '該当なし') {
    return 0;
  }

  return Number(
    row[2].replace('円', '').replace(/,/g, '')
  );
}

async function fetchDrawResult(drawNumber) {
  const drawNumberText =
    String(drawNumber).padStart(4, '0');

  const detailUrl =
    `${baseUrl}/A102${drawNumberText}.CSV`;

  const response = await fetch(detailUrl);

  if (!response.ok) {
    throw new Error(
      `第${drawNumber}回の詳細CSV取得失敗: ${response.status}`
    );
  }

  const buffer = await response.arrayBuffer();
  const csv = decoder.decode(buffer);

  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const rows = lines.map((line) => line.split(','));

  const drawInfo = rows[1];

  const actualDrawNumber = Number(
    drawInfo[0].match(/第(\d+)回/)[1]
  );

  const drawDate = parseJapaneseDate(drawInfo[2]);

  const numberInfo = rows[3];

  const winningNumbers = numberInfo
    .slice(1, 7)
    .map(Number);

  const bonusNumber = Number(numberInfo[8]);

  const prize1 = parsePrize(rows[4]);
  const prize2 = parsePrize(rows[5]);
  const prize3 = parsePrize(rows[6]);
  const prize4 = parsePrize(rows[7]);
  const prize5 = parsePrize(rows[8]);

  const carryOver = Number(
    rows[9][1].replace('円', '').replace(/,/g, '')
  );

  const salesAmount = Number(
    rows[10][1].replace('円', '').replace(/,/g, '')
  );

  return {
    draw_number: actualDrawNumber,
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
}

try {
  await mkdir('./data', { recursive: true });

  console.log('一覧CSVを取得中...');

  const indexResponse = await fetch(indexUrl);

  if (!indexResponse.ok) {
    throw new Error(
      `一覧CSV取得失敗: ${indexResponse.status} ${indexResponse.statusText}`
    );
  }

  const indexBuffer = await indexResponse.arrayBuffer();
  const indexCsv = decoder.decode(indexBuffer);

  const drawNumbers = [
    ...indexCsv.matchAll(/第(\d+)回ロト６/g),
  ].map((match) => Number(match[1]));

  if (drawNumbers.length === 0) {
    throw new Error('回号を取得できませんでした');
  }

  const uniqueDrawNumbers = [
    ...new Set(drawNumbers),
  ].sort((a, b) => a - b);

  console.log(
    `取得対象: ${uniqueDrawNumbers.length}回`
  );

  const results = [];

  for (const drawNumber of uniqueDrawNumbers) {
    try {
      console.log(`取得中: 第${drawNumber}回`);

      const result = await fetchDrawResult(drawNumber);

      results.push(result);
    } catch (error) {
      console.error(
        `第${drawNumber}回の取得に失敗:`,
        error
      );
    }
  }

  results.sort(
    (a, b) => a.draw_number - b.draw_number
  );

  await writeFile(
    './data/all.json',
    JSON.stringify(results, null, 2),
    'utf8'
  );

  const latestResult =
    results[results.length - 1];

  await writeFile(
    './data/latest.json',
    JSON.stringify(latestResult, null, 2),
    'utf8'
  );

  console.log(
    `\n過去${results.length}回の結果を保存しました。`
  );

  console.log(
    '保存先: ./data/all.json'
  );

  console.log(
    `最新回: 第${latestResult.draw_number}回`
  );

} catch (error) {
  console.error('error:', error);
  process.exitCode = 1;
}
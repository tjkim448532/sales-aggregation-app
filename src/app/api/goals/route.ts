import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 임시 로컬 DB (Firebase 도입 전)
const DATA_FILE = path.join(os.tmpdir(), 'goals_db.json');

// 초기 데이터 구조 보장
const initDB = () => {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8');
  }
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json({ error: 'year, month 파라미터가 필요합니다.' }, { status: 400 });
    }

    initDB();
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const key = `${year}-${month.padStart(2, '0')}`;

    if (data[key]) {
      return NextResponse.json({ success: true, data: data[key] });
    } else {
      // 기본값 반환
      return NextResponse.json({
        success: true,
        data: {
          targetRn: 500,
          targetRev: 50000000,
          targetOcc: 80
        }
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { year, month, targetRn, targetRev, targetOcc } = body;

    if (!year || !month) {
      return NextResponse.json({ error: 'year, month 파라미터가 필요합니다.' }, { status: 400 });
    }

    initDB();
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const key = `${year}-${String(month).padStart(2, '0')}`;

    data[key] = {
      targetRn: Number(targetRn),
      targetRev: Number(targetRev),
      targetOcc: Number(targetOcc)
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: '목표가 성공적으로 저장되었습니다.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

"""
下载指数K线历史数据（恒生科技、恒生指数、沪深300）
数据源：东方财富 push2his API（直接调用，绕过 akshare 的 spot 查询）
输出格式：与 eth_usdt_swap_daily_30d.json 一致的 JSON 格式
支持：日K（默认）或 1小时K（--interval 1h --days 7）
"""

import argparse
import json
import os
import time
from datetime import datetime, timedelta

import requests
import pandas as pd

# 确保清除可能干扰的代理设置
for key in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]:
    os.environ.pop(key, None)

# 指数配置列表
# secid 格式: 市场编号.代码
#   124 = 恒生系列指数
#   100 = 港股指数
#   1   = 上证系列指数
INDICES = [
    {
        "name": "恒生科技指数",
        "secid": "124.HSTECH",
        "start_date": "2020-07-01",
        "output_filename": "hstech_daily_20200701_20260205.json",
    },
    {
        "name": "恒生指数",
        "secid": "100.HSI",
        "start_date": "2021-02-01",
        "output_filename": "hsi_daily.json",
    },
    {
        "name": "沪深300",
        "secid": "1.000300",
        "start_date": "2005-01-01",
        "output_filename": "csi300_daily.json",
    },
    {
        "name": "中证500",
        "secid": "1.000905",
        "start_date": "2007-01-01",
        "output_filename": "csi500_daily.json",
    },
]


# klt: 60=60分(1小时)K, 101=日K
KLT_MAP = {"1h": "60", "60": "60", "daily": "101", "1d": "101"}


def fetch_index_klines(secid, name, klt="101", lmt="10000"):
    """直接调用东方财富历史K线API获取指数数据"""
    url = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
    params = {
        "secid": secid,
        "klt": klt,
        "fqt": "1",
        "lmt": lmt,
        "end": "20500000",
        "iscca": "1",
        "fields1": "f1,f2,f3,f4,f5,f6,f7,f8",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64",
        "ut": "f057cbcbce2a86e2866ab8877db1d059",
        "forcect": "1",
    }

    print(f"请求 API: {url}")
    print(f"secid: {secid} ({name}) klt={klt}")

    r = requests.get(url, params=params, timeout=30)
    data_json = r.json()

    if not data_json.get("data") or not data_json["data"].get("klines"):
        print(f"API 返回异常: {json.dumps(data_json, ensure_ascii=False)[:500]}")
        return None

    klines = data_json["data"]["klines"]
    print(f"API 返回 {len(klines)} 条K线数据")

    # 解析K线数据
    # 格式: "日期,开盘,收盘,最高,最低,成交量,成交额,振幅,涨跌幅,涨跌额,换手率,..."
    records = []
    for line in klines:
        parts = line.split(",")
        records.append({
            "date": parts[0],
            "open": float(parts[1]),
            "close": float(parts[2]),
            "high": float(parts[3]),
            "low": float(parts[4]),
            "volume": float(parts[5]) if parts[5] and parts[5] != "-" else 0,
            "turnover": float(parts[6]) if parts[6] and parts[6] != "-" else 0,
        })

    df = pd.DataFrame(records)
    return df


def _parse_datetime(date_str, is_hourly):
    """解析日期字符串，支持 1h 的 'YYYY-MM-DD HH:MM' 或日K的 'YYYY-MM-DD'"""
    s = str(date_str).strip()
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析日期: {date_str}")


def download_index_data(index_config, interval="daily", days=None):
    """下载指数K线数据并保存为 JSON
    interval: 'daily'|'1h'  周期
    days: 仅当 interval='1h' 时有效，限制最近 N 天的数据
    """

    name = index_config["name"]
    secid = index_config["secid"]
    output_filename = index_config["output_filename"]

    is_hourly = interval in ("1h", "60")
    klt = KLT_MAP.get(interval, "101")

    if is_hourly:
        # 1小时K：7天约 7*6 交易时段 ≈ 42 条，请求 300 条确保足够
        lmt = "500"
        if days:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
        else:
            start_date = datetime.now() - timedelta(days=7)
            end_date = datetime.now()
        print(f"\n{'='*50}")
        print(f"正在下载{name} ({secid}) 1小时K线数据...")
        print(f"时间范围: 最近 {days or 7} 天\n")
    else:
        lmt = "10000"
        start_date_str = index_config["start_date"]
        end_date_str = datetime.now().strftime("%Y-%m-%d")
        print(f"\n{'='*50}")
        print(f"正在下载{name} ({secid}) 日K线数据...")
        print(f"时间范围: {start_date_str} ~ {end_date_str}\n")

    # 带重试下载
    df = None
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            print(f"第 {attempt}/{max_retries} 次尝试...")
            df = fetch_index_klines(secid, name, klt=klt, lmt=lmt)
            if df is not None and not df.empty:
                break
        except Exception as e:
            print(f"下载失败: {type(e).__name__}: {e}")
        if attempt < max_retries:
            wait = attempt * 3
            print(f"等待 {wait} 秒后重试...\n")
            time.sleep(wait)

    if df is None or df.empty:
        print(f"错误: 多次尝试后仍未能获取到{name}数据！")
        return

    print(f"\n原始数据共 {len(df)} 条")

    # 筛选日期范围
    if is_hourly:
        def in_range(x):
            try:
                dt = _parse_datetime(x, True)
                return start_date <= dt <= end_date
            except Exception:
                return False

        df["_parsed"] = df["date"].apply(lambda x: _parse_datetime(x, True))
        df = df[(df["_parsed"] >= start_date) & (df["_parsed"] <= end_date)]
        df = df.drop(columns=["_parsed"])
        # 1h 输出文件名
        output_filename = output_filename.replace(".json", f"_1h_{days or 7}d.json")
    else:
        start_date_str = index_config["start_date"]
        end_date_str = datetime.now().strftime("%Y-%m-%d")
        df = df[(df["date"] >= start_date_str) & (df["date"] <= end_date_str)]

    df = df.sort_values("date").reset_index(drop=True)
    print(f"筛选后共 {len(df)} 条数据")

    # 转换为目标 JSON 格式
    records = []
    for _, row in df.iterrows():
        dt = _parse_datetime(row["date"], is_hourly)
        timestamp_ms = str(int(dt.timestamp() * 1000))

        record = {
            "时间": dt.strftime("%Y-%m-%d %H:%M:%S"),
            "时间戳": timestamp_ms,
            "开盘价": round(float(row["open"]), 2),
            "最高价": round(float(row["high"]), 2),
            "最低价": round(float(row["low"]), 2),
            "收盘价": round(float(row["close"]), 2),
            "成交量": int(row["volume"]) if row["volume"] > 0 else None,
            "成交额": round(float(row["turnover"]), 2) if row["turnover"] > 0 else None,
            "确认状态": "1"
        }
        records.append(record)

    # 按时间升序排列
    records.sort(key=lambda x: x["时间戳"])

    # 输出文件路径
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
    output_file = os.path.join(output_dir, output_filename)

    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    # 保存 JSON
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    # 打印摘要
    print(f"\n===== {name} 数据摘要 =====")
    print(f"数据条数: {len(records)}")
    print(f"起始时间: {records[0]['时间']}")
    print(f"结束时间: {records[-1]['时间']}")
    print(f"起始收盘价: {records[0]['收盘价']}")
    print(f"结束收盘价: {records[-1]['收盘价']}")
    print(f"最高价: {max(r['最高价'] for r in records)} (出现于 {max(records, key=lambda r: r['最高价'])['时间']})")
    print(f"最低价: {min(r['最低价'] for r in records)} (出现于 {min(records, key=lambda r: r['最低价'])['时间']})")
    print(f"\n输出文件: {output_file}")
    print(f"文件大小: {os.path.getsize(output_file) / 1024:.1f} KB")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="下载指数K线数据（恒生科技、恒生指数等）")
    parser.add_argument("--interval", "-i", default="daily", choices=["daily", "1h"],
                        help="K线周期: daily=日K, 1h=1小时K")
    parser.add_argument("--days", "-d", type=int, default=None,
                        help="1小时模式下限制最近 N 天数据（默认7）")
    parser.add_argument("--index", type=str, default=None,
                        help="仅下载指定指数，如 hstech/hsi/csi300/csi500")
    args = parser.parse_args()

    days = args.days
    if args.interval == "1h" and days is None:
        days = 7

    # 筛选要下载的指数
    indices = INDICES
    if args.index:
        idx_map = {"hstech": 0, "hsi": 1, "csi300": 2, "csi500": 3}
        i = idx_map.get(args.index.lower())
        if i is not None:
            indices = [INDICES[i]]
        else:
            print(f"未知指数: {args.index}，将下载全部")
    for index_config in indices:
        download_index_data(index_config, interval=args.interval, days=days)

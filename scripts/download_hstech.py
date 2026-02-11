"""
下载指数日K线历史数据（恒生科技、恒生指数、沪深300）
数据源：东方财富 push2his API（直接调用，绕过 akshare 的 spot 查询）
输出格式：与 eth_usdt_swap_daily_30d.json 一致的 JSON 格式
"""

import json
import os
import time
from datetime import datetime

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


def fetch_index_daily(secid, name):
    """直接调用东方财富历史K线API获取指数数据"""
    url = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
    params = {
        "secid": secid,
        "klt": "101",       # 101=日K
        "fqt": "1",
        "lmt": "10000",
        "end": "20500000",
        "iscca": "1",
        "fields1": "f1,f2,f3,f4,f5,f6,f7,f8",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64",
        "ut": "f057cbcbce2a86e2866ab8877db1d059",
        "forcect": "1",
    }

    print(f"请求 API: {url}")
    print(f"secid: {secid} ({name})")

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


def download_index_daily(index_config):
    """下载指数日K线数据并保存为 JSON"""

    name = index_config["name"]
    secid = index_config["secid"]
    start_date = index_config["start_date"]
    end_date = datetime.now().strftime("%Y-%m-%d")
    output_filename = index_config["output_filename"]

    print(f"\n{'='*50}")
    print(f"正在下载{name} ({secid}) 日K线数据...")
    print(f"时间范围: {start_date} ~ {end_date}\n")

    # 带重试下载
    df = None
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            print(f"第 {attempt}/{max_retries} 次尝试...")
            df = fetch_index_daily(secid, name)
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
    df = df[(df["date"] >= start_date) & (df["date"] <= end_date)]
    df = df.sort_values("date").reset_index(drop=True)

    print(f"筛选后共 {len(df)} 条数据")

    # 转换为目标 JSON 格式
    records = []
    for _, row in df.iterrows():
        dt = datetime.strptime(str(row["date"]), "%Y-%m-%d")
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
    for index_config in INDICES:
        download_index_daily(index_config)

import { useState } from "react";
import {
  Card,
  InputNumber,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Select,
  Table,
} from "antd";
import { CalculatorOutlined } from "@ant-design/icons";

interface MonthRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

type Mode = "equal-installment" | "equal-principal";

function formatMoney(val: number): string {
  return val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function MortgageCalc() {
  const [loanAmount, setLoanAmount] = useState<number | null>(100);
  const [years, setYears] = useState<number | null>(30);
  const [rate, setRate] = useState<number | null>(4.2);
  const [downPercent, setDownPercent] = useState<number | null>(30);
  const [mode, setMode] = useState<Mode>("equal-installment");
  const [result, setResult] = useState<{
    monthly: number;
    totalInterest: number;
    totalPayment: number;
    firstMonth?: number;
    monthlyDecrease?: number;
    schedule: MonthRow[];
  } | null>(null);

  const calc = () => {
    const loan = (loanAmount ?? 0) * 10000;
    const months = (years ?? 0) * 12;
    const monthlyRate = (rate ?? 0) / 100 / 12;

    if (!loan || !months || !monthlyRate) return;

    if (mode === "equal-installment") {
      const temp = Math.pow(1 + monthlyRate, months);
      const monthly =
        (loan * monthlyRate * temp) / (temp - 1);
      const totalPayment = monthly * months;
      const totalInterest = totalPayment - loan;

      const schedule: MonthRow[] = [];
      let balance = loan;
      for (let i = 1; i <= Math.min(12, months); i++) {
        const interest = balance * monthlyRate;
        const principal = monthly - interest;
        balance -= principal;
        schedule.push({
          month: i,
          payment: monthly,
          principal,
          interest,
          balance: Math.max(0, balance),
        });
      }

      setResult({
        monthly,
        totalInterest,
        totalPayment,
        schedule,
      });
    } else {
      const monthlyPrincipal = loan / months;
      let balance = loan;
      const schedule: MonthRow[] = [];
      let totalPayment = 0;

      for (let i = 1; i <= months; i++) {
        const interest = balance * monthlyRate;
        const payment = monthlyPrincipal + interest;
        totalPayment += payment;
        balance -= monthlyPrincipal;
        if (i <= 12) {
          schedule.push({
            month: i,
            payment,
            principal: monthlyPrincipal,
            interest,
            balance: Math.max(0, balance),
          });
        }
      }

      const totalInterest = totalPayment - loan;

      setResult({
        monthly: 0,
        totalInterest,
        totalPayment,
        firstMonth: loan * monthlyRate + monthlyPrincipal,
        monthlyDecrease: monthlyPrincipal * monthlyRate,
        schedule,
      });
    }
  };

  const columns = [
    {
      title: "期数",
      dataIndex: "month",
      key: "month",
      render: (v: number) => `第${v}期`,
    },
    {
      title: "月供（元）",
      dataIndex: "payment",
      key: "payment",
      render: (v: number) => formatMoney(v),
    },
    {
      title: "本金（元）",
      dataIndex: "principal",
      key: "principal",
      render: (v: number) => formatMoney(v),
    },
    {
      title: "利息（元）",
      dataIndex: "interest",
      key: "interest",
      render: (v: number) => formatMoney(v),
    },
    {
      title: "剩余本金（元）",
      dataIndex: "balance",
      key: "balance",
      render: (v: number) => formatMoney(v),
    },
  ];

  return (
    <Card title="房贷计算器">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Typography.Text>贷款金额（万元）</Typography.Text>
            <InputNumber
              min={1}
              max={10000}
              value={loanAmount}
              onChange={(v) => setLoanAmount(v as number | null)}
              style={{ width: "100%" }}
              size="large"
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Typography.Text>贷款年限（年）</Typography.Text>
            <InputNumber
              min={1}
              max={40}
              value={years}
              onChange={(v) => setYears(v as number | null)}
              style={{ width: "100%" }}
              size="large"
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Typography.Text>年利率（%）</Typography.Text>
            <InputNumber
              min={0.01}
              max={20}
              step={0.01}
              value={rate}
              onChange={(v) => setRate(v as number | null)}
              style={{ width: "100%" }}
              size="large"
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Typography.Text>首付比例（%）</Typography.Text>
            <InputNumber
              min={0}
              max={90}
              value={downPercent}
              onChange={(v) => setDownPercent(v as number | null)}
              style={{ width: "100%" }}
              size="large"
            />
          </Col>
        </Row>

        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Typography.Text>还款方式：</Typography.Text>
              <Select
                value={mode}
                onChange={setMode}
                options={[
                  { value: "equal-installment", label: "等额本息" },
                  { value: "equal-principal", label: "等额本金" },
                ]}
                style={{ width: 140 }}
                size="large"
              />
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              onClick={calc}
              size="large"
            >
              计算
            </Button>
          </Col>
        </Row>

        {result && (
          <>
            <Row gutter={[16, 16]}>
              {mode === "equal-installment" ? (
                <>
                  <Col xs={24} sm={8}>
                    <div
                      style={{
                        padding: 16,
                        border: "1px solid #d9d9d9",
                        borderRadius: 8,
                        background: "#e6f7ff",
                        textAlign: "center",
                      }}
                    >
                      <Typography.Text type="secondary">
                        每月还款
                      </Typography.Text>
                      <div>
                        <Typography.Text
                          strong
                          style={{ fontSize: 22, color: "#1890ff" }}
                        >
                          {formatMoney(result.monthly)} 元
                        </Typography.Text>
                      </div>
                    </div>
                  </Col>
                </>
              ) : (
                <>
                  <Col xs={24} sm={6}>
                    <div
                      style={{
                        padding: 16,
                        border: "1px solid #d9d9d9",
                        borderRadius: 8,
                        background: "#e6f7ff",
                        textAlign: "center",
                      }}
                    >
                      <Typography.Text type="secondary">
                        首月还款
                      </Typography.Text>
                      <div>
                        <Typography.Text
                          strong
                          style={{ fontSize: 22, color: "#1890ff" }}
                        >
                          {formatMoney(result.firstMonth ?? 0)} 元
                        </Typography.Text>
                      </div>
                    </div>
                  </Col>
                  <Col xs={24} sm={6}>
                    <div
                      style={{
                        padding: 16,
                        border: "1px solid #d9d9d9",
                        borderRadius: 8,
                        background: "#fff7e6",
                        textAlign: "center",
                      }}
                    >
                      <Typography.Text type="secondary">
                        每月递减
                      </Typography.Text>
                      <div>
                        <Typography.Text
                          strong
                          style={{ fontSize: 22, color: "#fa8c16" }}
                        >
                          {formatMoney(result.monthlyDecrease ?? 0)} 元
                        </Typography.Text>
                      </div>
                    </div>
                  </Col>
                </>
              )}
              <Col xs={24} sm={8}>
                <div
                  style={{
                    padding: 16,
                    border: "1px solid #d9d9d9",
                    borderRadius: 8,
                    background: "#f6ffed",
                    textAlign: "center",
                  }}
                >
                  <Typography.Text type="secondary">总利息</Typography.Text>
                  <div>
                    <Typography.Text
                      strong
                      style={{ fontSize: 22, color: "#52c41a" }}
                    >
                      {formatMoney(result.totalInterest)} 元
                    </Typography.Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div
                  style={{
                    padding: 16,
                    border: "1px solid #d9d9d9",
                    borderRadius: 8,
                    background: "#fafafa",
                    textAlign: "center",
                  }}
                >
                  <Typography.Text type="secondary">还款总额</Typography.Text>
                  <div>
                    <Typography.Text strong style={{ fontSize: 22 }}>
                      {formatMoney(result.totalPayment)} 元
                    </Typography.Text>
                  </div>
                </div>
              </Col>
            </Row>

            <div>
              <Typography.Text strong>还款明细（前12期）</Typography.Text>
              <Table
                dataSource={result.schedule}
                columns={columns}
                rowKey="month"
                pagination={false}
                size="small"
                style={{ marginTop: 8 }}
                locale={{ emptyText: " " }}
              />
            </div>
          </>
        )}
      </Space>
    </Card>
  );
}

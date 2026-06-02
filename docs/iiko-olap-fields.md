# Справочник OLAP-полей iiko (SALES)

`iiko-olap-fields.json` — полный каталог доступных полей OLAP-отчёта `SALES`
(285 полей), выгруженный из:

```
GET https://host:port/resto/api/v2/reports/olap/columns?reportType=SALES&key={key}
```

Каждое поле описано так:

```json
"ProductCostBase.MarkUp": {
  "name": "Наценка(%)",
  "type": "PERCENT",
  "aggregationAllowed": true,
  "groupingAllowed": false,
  "filteringAllowed": false,
  "tags": ["Себестоимость"]
}
```

- `type` — `MONEY` | `PERCENT` | `AMOUNT` | `INTEGER` | `STRING` | `ID` | `DATETIME` | `ENUM` | `DURATION_IN_SECONDS`
- `aggregationAllowed` — можно класть в `aggregateFields`
- `groupingAllowed` — можно класть в `groupByRowFields` / `groupByColFields`
- `PERCENT` возвращается долей: `2.086` = `208.6%` (умножать на 100 для отображения)

## Используемые в проекте поля

| Поле | Назначение | Где |
|------|-----------|-----|
| `Department` | Заведение (группировка) | все запросы |
| `OpenDate.Typed` | Учётный день (группировка/фильтр) | все запросы |
| `PayTypes` | Тип оплаты | sync pay types |
| `HourOpen` | Час открытия (0..23) | sync hourly |
| `OrderDiscount.Type` | Тип скидки | sync discounts |
| `DishSumInt` | Сумма без скидки (gross) | summary |
| `DishDiscountSumInt` | Сумма со скидкой (net/выручка) | pay types, hourly, summary |
| `DiscountSum` | Сумма скидки | summary, discounts |
| `UniqOrderId.OrdersCount` | Кол-во чеков | hourly |
| `GuestNum` | Кол-во гостей | hourly |
| `ProductCostBase.Profit` | Наценка, ₽ | summary |
| `ProductCostBase.ProductCost` | Себестоимость, ₽ | summary |
| `ProductCostBase.MarkUp` | Наценка, % (нативная) | summary |

Логика синхронизации — `apps/worker/src/iiko/sync-iiko-sales.ts`.

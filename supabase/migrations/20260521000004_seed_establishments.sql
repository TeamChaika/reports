-- Seed: создаём заведения из реальных iiko departments
-- Запускается после первого sync departments

-- Эта миграция будет применена после первого запуска iiko sync.
-- Пока оставляем placeholder — воркер создаст establishments сам.

-- Для ручного заполнения после sync:
-- insert into establishments (iiko_department_id, name, code)
-- select id, name, code from iiko_departments where type = 'DEPARTMENT' and not is_deleted;

-- Список заведений из первого запуска API (14 DEPARTMENT):
-- [9]  Kiki Beach            db7e97a7-03d4-47b9-acdb-81b8bb197f8a
-- [6]  PTIZZA                9917e366-e83c-4128-8e5b-77ab37ed1cac
-- [20] В ЕЛЕНА               d663b9fe-88b7-4646-8025-d7450a8c7d26
-- [19] Гастро Двор           7872bfff-ad76-4445-a85c-b90a6b2ed9ff
-- [23] ЛИВАДИЯ               552129cb-dec9-4f28-918f-8a5148131860
-- [22] ПЛОВ                  49ceca24-6af0-4b11-bf33-fa7154c3f73e
-- [2]  Терияки               01e6406e-930c-41d9-9c8d-4493478e1073
-- [7]  ХАНГРИ ЦЕНТР          305cd9e0-f438-4b4d-a3ed-a147c9603ec3
-- [8]  Хангри Приморский     ce7dcefc-d16c-4a21-81b5-1d45d5323d8c
-- [12] Хангри Симеиз         e360bc35-71ee-47f8-b362-da8415b67c23
-- [5]  Чайка                 719a9247-1014-4383-b465-1c701b7c5249
-- [3]  Чайка на пляже        67521531-5cff-48fb-90d7-81a1fa61bb31
-- [95] ЯФирма                231a6b55-3b64-4b80-ad84-b97881bda814
-- [10] яЧайка Производство   f2dad9b8-1cfe-45fa-a336-14214d818687

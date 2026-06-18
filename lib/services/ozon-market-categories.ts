export type OzonMarketCategory = {
  id: string;
  label: string;
  ruLabel: string;
  keywords: string[];
};

export const ozonMarketCategories: OzonMarketCategory[] = [
  { id: "", label: "全部类目", ruLabel: "Все категории", keywords: [] },
  { id: "beauty_hair", label: "美妆个护 / 头发护理", ruLabel: "Красота / Уход за волосами", keywords: ["hair care", "шампунь", "сыворотка для волос", "маска для волос", "生发", "护发"] },
  { id: "beauty_skin", label: "美妆个护 / 面部护理", ruLabel: "Красота / Уход за лицом", keywords: ["skin care", "крем для лица", "сыворотка для лица", "护肤", "面霜"] },
  { id: "home_kitchen", label: "家居厨房", ruLabel: "Дом и кухня", keywords: ["kitchen organizer", "посуда", "органайзер для кухни", "家居", "厨房"] },
  { id: "electronics", label: "数码电子", ruLabel: "Электроника", keywords: ["phone case", "смартфон", "зарядка usb", "наушники", "数码", "电子"] },
  { id: "kids", label: "母婴儿童", ruLabel: "Детские товары", keywords: ["baby toy", "детская игрушка", "товары для детей", "母婴", "儿童"] },
  { id: "auto", label: "汽车用品", ruLabel: "Автотовары", keywords: ["car holder", "авто держатель", "автомобильные аксессуары", "汽车", "车载"] },
  { id: "fashion", label: "服饰配件", ruLabel: "Одежда и аксессуары", keywords: ["backpack", "сумка", "обувь", "аксессуары", "服饰", "鞋"] },
  { id: "sports", label: "运动户外", ruLabel: "Спорт и отдых", keywords: ["fitness", "спорт", "туризм", "тренировка", "运动", "户外"] },
  { id: "pet", label: "宠物用品", ruLabel: "Товары для животных", keywords: ["pet toy", "товары для животных", "кошка", "собака", "宠物"] },
  { id: "tools", label: "五金工具", ruLabel: "Инструменты", keywords: ["tool kit", "дрель", "набор инструментов", "工具"] },
  { id: "health", label: "健康护理", ruLabel: "Здоровье", keywords: ["massager", "витамины", "здоровье", "уход", "健康", "护理"] }
];

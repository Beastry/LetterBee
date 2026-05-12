export type PostOfficeOption = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type CityOption = {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  postOffices: PostOfficeOption[];
};

export const cityOptions: CityOption[] = [
  {
    id: "shenzhen",
    name: "深圳",
    country: "中国",
    latitude: 22.5431,
    longitude: 114.0579,
    postOffices: [
      {
        id: "shenzhen-central",
        name: "深圳中央邮政局",
        latitude: 22.5431,
        longitude: 114.0579,
      },
    ],
  },
  {
    id: "chengdu",
    name: "成都",
    country: "中国",
    latitude: 30.5728,
    longitude: 104.0668,
    postOffices: [
      {
        id: "chengdu-central",
        name: "成都中央邮政局",
        latitude: 30.5728,
        longitude: 104.0668,
      },
    ],
  },
  {
    id: "beijing",
    name: "北京",
    country: "中国",
    latitude: 39.9042,
    longitude: 116.4074,
    postOffices: [
      {
        id: "beijing-central",
        name: "北京中央邮政局",
        latitude: 39.9042,
        longitude: 116.4074,
      },
    ],
  },
  {
    id: "shanghai",
    name: "上海",
    country: "中国",
    latitude: 31.2304,
    longitude: 121.4737,
    postOffices: [
      {
        id: "shanghai-central",
        name: "上海中央邮政局",
        latitude: 31.2304,
        longitude: 121.4737,
      },
    ],
  },
  {
    id: "guangzhou",
    name: "广州",
    country: "中国",
    latitude: 23.1291,
    longitude: 113.2644,
    postOffices: [
      {
        id: "guangzhou-central",
        name: "广州中央邮政局",
        latitude: 23.1291,
        longitude: 113.2644,
      },
    ],
  },
];

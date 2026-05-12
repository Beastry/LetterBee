export type CityWithPostOffices = {
  id: string;
  name: string;
  postOffices: Array<{
    id: string;
    name: string;
  }>;
};

export type ProfileSelectionResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateProfileSelection({
  cityId,
  postOfficeId,
  cities,
}: {
  cityId: string;
  postOfficeId: string;
  cities: CityWithPostOffices[];
}): ProfileSelectionResult {
  const city = cities.find((item) => item.id === cityId);

  if (!city) {
    return { ok: false, error: "请选择常驻城市" };
  }

  const postOfficeBelongsToCity = city.postOffices.some(
    (postOffice) => postOffice.id === postOfficeId,
  );

  if (!postOfficeBelongsToCity) {
    return { ok: false, error: "请选择该城市下的邮政局" };
  }

  return { ok: true };
}

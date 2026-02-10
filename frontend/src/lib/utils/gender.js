export const formatGenderAbbrev = (gender) => {
  if (gender === 'male') return 'M';
  if (gender === 'female') return 'F';
  return '';
};

export const formatNameWithGender = (name, gender) => {
  const base = String(name || '').trim();
  if (!base) return '';
  const abbrev = formatGenderAbbrev(gender);
  return abbrev ? `${base} (${abbrev})` : base;
};

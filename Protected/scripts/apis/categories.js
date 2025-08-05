// /scripts/apis/categories.js
export async function insertNewCategory(formData) {
  const response = await fetch('/categories/submitForm', {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {}
    throw new Error(`Error ${response.status}: ${errMsg}`);
  }
  return response.json();
}

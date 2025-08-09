// /scripts/apis/categoriesManager.js

export async function insertNewCategory(formData) {
  return sendRequest('/categories/inser', 'POST', formData);
}

export async function updateCategory(formData) {
  return sendRequest('/categories/update', 'POST', formData);
}

export async function deleteCategory(formData) {
  return sendRequest('/categories/delete', 'POST', formData);
}

export async function getAllCategories() {
  return sendRequest('/categories/getAll', 'GET');
}

async function sendRequest(url, method, body = null) {
  const options = { method };
  if (body) options.body = body;

  const response = await fetch(url, options);

  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {}
    throw new Error(`Error: ${response.status}: ${errMsg}`);
  }

  return response.json();
}

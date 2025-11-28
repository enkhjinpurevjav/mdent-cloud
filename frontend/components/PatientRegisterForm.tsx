import React, { useState } from 'react';

export default function PatientRegisterForm({ onSuccess }) {
  const [form, setForm] = useState({
    name: '', regNo: '', phone: '', branchId: '', bookNumber: ''
  });
  const [error, setError] = useState('');

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess && onSuccess(data);
      } else {
        setError(data.error || 'Error');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Name" value={form.name} onChange={handleChange} required />
      <input name="regNo" placeholder="Citizen ID" value={form.regNo} onChange={handleChange} required />
      <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} required />
      <input name="branchId" placeholder="Branch ID" value={form.branchId} onChange={handleChange} required />
      <input name="bookNumber" placeholder="Book #" value={form.bookNumber} onChange={handleChange} required />
      <button type="submit">Register</button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </form>
  );
}

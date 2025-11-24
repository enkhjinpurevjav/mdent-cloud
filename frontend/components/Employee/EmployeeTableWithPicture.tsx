import React, { useEffect, useState } from 'react';

type Employee = {
  id: number;
  name: string;                // First name
  lastName?: string;           // Family/last name, if present
  email?: string;
  regNo: string;               // Citizen ID
  role: string;                // Doctor, Admin, Receptionist, Accountant, etc.
  branchId?: number;
  branchName?: string;         // UI-side join
  licenseNumber?: string;
  licenseExpiryDate?: string;
  signatureImagePath?: string;
  stampImagePath?: string;
  idPhotoPath?: string;        // Profile/doctor's photo
  status?: string;             // Active/Inactive
};

const fetchEmployees = async (): Promise<Employee[]> => {
  // Replace this with your actual API endpoint
  const res = await fetch('/api/employees');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

const EmployeeTableWithPicture: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);

  useEffect(() => {
    fetchEmployees()
      .then(setEmployees)
      .catch(() => alert('Ажилтнуудыг татаж чадсангүй.'));
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: 'auto', padding: 24 }}>
      <h2>Ажилтнууд</h2>
      <button style={{ float: 'right', marginBottom: 12 }}>+ Ажилтан нэмэх</button>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
        <thead>
          <tr>
            <th>№</th>
            <th>Зураг</th>
            <th>Нэр</th>
            <th>Овог</th>
            <th>Регистр</th>
            <th>Эрх</th>
            <th>Салбар</th>
            <th>Үйлдэл</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e, idx) => (
            <tr key={e.id}>
              <td>{idx + 1}</td>
              <td>
                {e.idPhotoPath ? (
                  <img
                    src={e.idPhotoPath}
                    alt="Зураг"
                    style={{
                      width: 40,
                      height: 40,
                      objectFit: 'cover',
                      borderRadius: '50%',
                      border: '1px solid #ccc',
                      background: '#fafafa'
                    }}
                  />
                ) : (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#eee'
                    }}
                  />
                )}
              </td>
              <td>{e.name}</td>
              <td>{e.lastName}</td>
              <td>{e.regNo}</td>
              <td>
                <span
                  style={{
                    padding: '3px 12px',
                    borderRadius: 8,
                    background: e.role === 'doctor' ? '#d4f5d4' : '#f5f5fa',
                    color: '#333',
                    fontWeight: 500
                  }}>
                  {e.role}
                </span>
              </td>
              <td>
                <span
                  style={{
                    background: '#b3e5ff',
                    borderRadius: 8,
                    padding: '3px 10px',
                    fontWeight: 500
                  }}>
                  {e.branchName || e.branchId}
                </span>
              </td>
              <td>
                <button onClick={() => setSelected(e)} title="View">&#128065;</button>
                <button style={{ marginLeft: 5 }} title="Edit">&#9998;</button>
                <button style={{ marginLeft: 5 }} title="Delete">&#128465;</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div
          style={{
            position: 'fixed',
            top: 60,
            right: 60,
            width: 340,
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 2px 24px #9999',
            zIndex: 99,
            padding: 24
          }}>
          <h3>Ажилтны дэлгэрэнгүй</h3>
          <div style={{ textAlign: "center" }}>
            {selected.idPhotoPath && (
              <img
                src={selected.idPhotoPath}
                alt="Зураг"
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginBottom: 8
                }}
              />
            )}
          </div>
          <dl>
            <dt>Нэр</dt><dd>{selected.name}</dd>
            <dt>Овог</dt><dd>{selected.lastName}</dd>
            <dt>Регистр</dt><dd>{selected.regNo}</dd>
            <dt>Эрх</dt><dd>{selected.role}</dd>
            <dt>Салбар</dt><dd>{selected.branchName || selected.branchId}</dd>
            {selected.licenseNumber && <><dt>Лицензийн дугаар</dt><dd>{selected.licenseNumber}</dd></>}
            {selected.licenseExpiryDate && <><dt>Лиценз дуусах</dt><dd>{selected.licenseExpiryDate}</dd></>}
            {selected.stampImagePath && (
              <>
                <dt>Тамга</dt>
                <dd>
                  <img src={selected.stampImagePath} alt="Тамга" style={{ width: 60 }} />
                </dd>
              </>
            )}
          </dl>
          <button
            style={{
              position: "absolute",
              top: 10,
              right: 14,
              background: "#eee",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
            onClick={() => setSelected(null)}
          >
            Хаах
          </button>
        </div>
      )}
    </div>
  );
};

export default EmployeeTableWithPicture;

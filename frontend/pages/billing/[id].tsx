import React, { useState } from 'react';

const ServicePickerModal = ({ services }) => {
    const [serviceQuery, setServiceQuery] = useState('');
    const filteredServices = serviceQuery.length > 0 ? services.filter(service => 
        service.name.includes(serviceQuery) || service.code.includes(serviceQuery)
    ) : [];

    return (
        <div>
            <input 
                type="text" 
                value={serviceQuery} 
                onChange={(e) => setServiceQuery(e.target.value)} 
                placeholder="Нэр эсвэл код оруулаад хайна уу"
            />
            {serviceQuery.length === 0 && <p>Нэр эсвэл код оруулаад хайна уу</p>}
            {serviceQuery.length > 0 && filteredServices.length === 0 && <p>Хайлтад тохирох үйлчилгээ олдсонгүй.</p>}
            <ul>
                {filteredServices.map(service => (
                    <li key={service.id}>{service.name} - {service.code}</li>
                ))}
            </ul>
        </div>
    );
};

export default ServicePickerModal;

// Update Service type to include category
export type Service = {
    id: number;
    name: string;
    code: string;
    category: string; // Category added for future imaging logic
};
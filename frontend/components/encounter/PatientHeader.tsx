const PatientHeader = ({ hideMiniNav, showPatientDetailsButton }) => {
  return (
    <div>
      {!hideMiniNav && <nav>Your Mini Nav</nav>}
      {showPatientDetailsButton && (
        <a 
          className="btn tailwind-class"
          href={`/patients/${bookNumber}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Үйлчлүүлэгчийн дэлгэрэнгүй
        </a>
      )}
    </div>
  );
};

export default PatientHeader;
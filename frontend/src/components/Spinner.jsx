export default function Spinner({ size = 18 }) {
    return (
        <span
            style={{
                display: 'inline-block',
                width: size,
                height: size,
                border: '2px solid rgba(255,255,255,.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin .7s linear infinite',
            }}
        />
    );
}
